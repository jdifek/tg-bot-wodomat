// src/services/reports.js — отчёты продаж из НАШЕЙ базы (без запросов к китайскому API)
'use strict';

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const cfg = require('../config');
const logger = require('../logger');
const state = require('./stateManager');
const t = require('../locales/' + cfg.locale);

// Часовой пояс суток отчётов. Должен совпадать с STATS_TZ на бэкенде.
const TZ = process.env.TZ || 'Europe/Warsaw';

const WORDS = {
  ru: {
    report: 'ОТЧЁТ ПРОДАЖ',
    week: 'ЗА НЕДЕЛЮ',
    month: 'ЗА МЕСЯЦ',
    days: (n) => `ЗА ${n} ДН.`,
    empty: 'Нет продаж за период.',
    partial: 'Данные за период ещё докачиваются — цифры могут быть неполными.',
    fail: '⚠️ Не удалось получить данные. Попробуйте чуть позже.',
    btn10: '✅ 10 дней',
    btn30: '🔥 30 дней',
    btnDevices: '📱 Устройства',
    btnAlerts: '⚠️ Проблемы',
    btnReport: '📊 Сегодня',
  },
  pl: {
    report: 'RAPORT SPRZEDAŻY',
    week: 'ZA TYDZIEŃ',
    month: 'ZA MIESIĄC',
    days: (n) => `ZA ${n} DNI`,
    empty: 'Brak sprzedaży w tym okresie.',
    partial: 'Dane za ten okres są jeszcze uzupełniane — liczby mogą być niepełne.',
    fail: '⚠️ Nie udało się pobrać danych. Spróbuj za chwilę.',
    btn10: '✅ 10 dni',
    btn30: '🔥 30 dni',
    btnDevices: '📱 Urządzenia',
    btnAlerts: '⚠️ Problemy',
    btnReport: '📊 Dzisiaj',
  },
};
const W = WORDS[cfg.locale] || WORDS.pl;

// ── Время (можно подменить в тестах) ──
let nowFn = () => dayjs().tz(TZ);
const now = () => nowFn();
const today = () => now().format('YYYY-MM-DD');

// Последние n дней, включая сегодня
function lastDays(n) {
  const to = now();
  return { from: to.subtract(n - 1, 'day').format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD') };
}

const ddmm = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

// Эмодзи в заголовке быстрых отчётов: 10 дней ✅, 30 дней 🔥, остальное по умолчанию 📊
const RANGE_EMOJI = { 10: '✅', 30: '🔥' };
const rangeHeader = (days, r) =>
  `${RANGE_EMOJI[days] || '📊'} ${W.report} ${W.days(days)} (${ddmm(r.from)} — ${ddmm(r.to)})`;

// ── Запрос к нашему бэкенду ──
async function fetchReport(appid, saler, from, to) {
  const key = process.env.BOT_API_KEY;
  if (!key) {
    logger.error('reports: BOT_API_KEY is not set');
    return null;
  }
  try {
    const url =
      `${cfg.secondBackUrl}/api/bot/report?appid=${encodeURIComponent(appid)}` +
      `&saler=${encodeURIComponent(saler)}&from=${from}&to=${to}`;
    const res = await fetch(url, { headers: { 'x-bot-key': key }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      logger.error(`reports: backend answered ${res.status} for ${saler} ${from}..${to}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    logger.error(`reports: ${err.message}`);
    return null;
  }
}

// ── Текст отчёта ──
function formatReport(header, data) {
  const rows = (data.devices || [])
    .filter((d) => d.txCount > 0)
    .sort((a, b) => String(a.location || a.deviceId).localeCompare(String(b.location || b.deviceId)));

  if (!rows.length) return `${header}\n${W.empty}`;

  let totalL = 0;
  let totalA = 0;
  const lines = [header];
  for (const d of rows) {
    lines.push(t.dailyReportLine(d.location || d.deviceId, d.liters.toFixed(1), d.amount.toFixed(2)));
    totalL += d.liters;
    totalA += d.amount;
  }
  lines.push(t.dailyReportTotal(totalL.toFixed(1), totalA.toFixed(2)));
  return lines.join('\n');
}

// ── Плановые отчёты: в очередь отправки, только если данные готовы ──
async function queueReport(saler, appid, header, from, to, { force = false } = {}) {
  const data = await fetchReport(appid, saler, from, to);
  if (!data) return false;

  if (!data.complete && !force) {
    logger.info(`[${saler}] report ${from}..${to}: data not complete yet, will retry`);
    return false;
  }

  let text = formatReport(header, data);
  if (!data.complete) text += `\n\n⚠️ ${W.partial}`;

  state.addPendingAlertToAll(saler, { type: 'period_report', isReport: true, msg: text });
  return true;
}

// Если данные так и не собрались, через 6 часов после времени отчёта отправляем как есть
const forceNow = (n) => n.hour() >= cfg.dailyReportHour + 6;

async function checkDaily(userState) {
  const { appid, saler } = userState;
  const n = now();
  const date = n.format('YYYY-MM-DD');

  if (n.hour() < cfg.dailyReportHour) return;
  if (state.getDailyReportSent(saler) === date) return;

  const y = n.subtract(1, 'day').format('YYYY-MM-DD');
  const dailyHeader = t.dailyReportHeader(y).replace('📊', '💧💰');
  if (await queueReport(saler, appid, dailyHeader, y, y, { force: forceNow(n) })) {
    state.setDailyReportSent(saler, date);
    logger.info(`[${saler}] daily report queued for ${y}`);
  }
}

async function checkWeekly(userState) {
  const { appid, saler } = userState;
  const n = now();

  if (n.day() !== 1 || n.hour() < cfg.dailyReportHour) return; // понедельник
  const key = n.format('YYYY-MM-DD');
  if (state.getWeeklyReportSent(saler) === key) return;

  const from = n.subtract(7, 'day');
  const to = n.subtract(1, 'day');
  const header = `💧✅ ${W.report} ${W.week} (${from.format('DD.MM')}–${to.format('DD.MM.YYYY')})`;

  if (await queueReport(saler, appid, header, from.format('YYYY-MM-DD'), to.format('YYYY-MM-DD'), { force: forceNow(n) })) {
    state.setWeeklyReportSent(saler, key);
    logger.info(`[${saler}] weekly report queued`);
  }
}

async function checkMonthly(userState) {
  const { appid, saler } = userState;
  const n = now();

  if (n.date() !== 1 || n.hour() < cfg.dailyReportHour) return; // 1-е число
  const lastMonth = n.subtract(1, 'month');
  const key = lastMonth.format('YYYY-MM');
  if (state.getMonthlyReportSent(saler) === key) return;

  const from = lastMonth.startOf('month');
  const to = lastMonth.endOf('month');
  const header = `💧🔥 ${W.report} ${W.month} (${lastMonth.format('MM.YYYY')})`;

  if (await queueReport(saler, appid, header, from.format('YYYY-MM-DD'), to.format('YYYY-MM-DD'), { force: forceNow(n) })) {
    state.setMonthlyReportSent(saler, key);
    logger.info(`[${saler}] monthly report queued for ${key}`);
  }
}

async function runScheduledReports(userState) {
  for (const [name, fn] of [['daily', checkDaily], ['weekly', checkWeekly], ['monthly', checkMonthly]]) {
    try {
      await fn(userState);
    } catch (err) {
      logger.error(`🔥 ${name} report error for saler=${userState.saler}: ${err.message}`);
    }
  }
}

module.exports = {
  TZ,
  W,
  BTN_10: W.btn10,
  BTN_30: W.btn30,
  BTN_DEVICES: W.btnDevices,
  BTN_ALERTS: W.btnAlerts,
  BTN_REPORT: W.btnReport,
  today,
  lastDays,
  rangeHeader,
  fetchReport,
  formatReport,
  runScheduledReports,
  _setNow: (fn) => { nowFn = fn; }, // только для тестов
};