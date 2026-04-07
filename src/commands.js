// src/commands.js — обработчики команд Telegram бота
'use strict';

const dayjs   = require('dayjs');
const cfg     = require('./config');
const logger  = require('./logger');
const api     = require('./services/apiClient');
const state   = require('./services/stateManager');
const sender  = require('./services/sender');
const t       = require('./locales/' + cfg.locale);

// ================================================================
// /start — инициализация пользователя
// Ожидаемый параметр: APPID_<appid>_SALER_<saler>
// Пример: /start APPID_abc123_SALER_myshop
// ================================================================
async function handleStart(ctx) {
  const chatId = String(ctx.chat.id);
  const param  = ctx.message?.text?.split(' ')[1] || '';

  logger.info(`/start from ${chatId}, param: ${param}`);

  // Если уже зарегистрирован
  const existing = state.getUser(chatId);
  if (existing && !param) {
    return ctx.reply(t.alreadyRegistered(existing.saler), { parse_mode: 'Markdown' });
  }

  // Парсим параметры из ссылки
  // Формат: APPID_<appid>_SALER_<saler>
  let appid, saler;

  if (param) {
    const appidMatch = param.match(/APPID_([^_]+(?:_[^S][^A][^L][^E][^R]_?)*)/i);
    const salerMatch = param.match(/SALER_(.+)$/i);

    // Попробуем проще: разбиваем по APPID_ и SALER_
    const parts = param.split(/_?SALER_/i);
    if (parts.length === 2) {
      appid = parts[0].replace(/^APPID_/i, '').trim();
      saler = parts[1].trim();
    }
  }

  if (!appid || !saler) {
    return ctx.reply(t.invalidStart, { parse_mode: 'Markdown' });
  }

  // Проверяем авторизацию через API
  await ctx.reply('⏳ Проверяем подключение к API...');
  const ok = await api.testAuth(appid, saler);
  if (!ok) {
    return ctx.reply(t.authFailed, { parse_mode: 'Markdown' });
  }

  // Сохраняем пользователя
  state.setUser(chatId, appid, saler);
  logger.info(`User registered: chatId=${chatId} saler=${saler}`);

  await ctx.reply(t.welcome(saler), {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        [{ text: '/status' }, { text: '/devices' }],
        [{ text: '/alerts' }, { text: '/report' }],
        [{ text: '/mute' },   { text: '/help' }],
      ],
      resize_keyboard: true,
    },
  });
}

// ================================================================
// /status — общий статус
// ================================================================
async function handleStatus(ctx) {
  const userState = state.getUser(String(ctx.chat.id));
  if (!userState) return ctx.reply(t.invalidStart, { parse_mode: 'Markdown' });

  const total   = userState.allDeviceIds.length;
  const alerts  = userState.activeAlerts.size;
  const mutedStr = state.isMuted(userState)
    ? t.monitoringMuted(dayjs(userState.muteUntil).format('HH:mm'))
    : t.monitoringActive;

  const lines = [
    t.cmdStatus,
    '',
    mutedStr,
    t.totalDevices(total),
    alerts > 0 ? t.activeAlerts(alerts) : t.noAlerts,
    '',
    `🏪 Аккаунт: \`${userState.saler}\``,
    `🕐 Обновлено: ${dayjs().format('DD.MM HH:mm')}`,
  ];

  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}

// ================================================================
// /devices — список аппаратов
// ================================================================
async function handleDevices(ctx) {
  const userState = state.getUser(String(ctx.chat.id));
  if (!userState) return ctx.reply(t.invalidStart, { parse_mode: 'Markdown' });

  const lines = [t.devicesHeader];
  if (userState.allDeviceIds.length === 0) {
    lines.push(t.devicesEmpty);
  } else {
    for (const id of userState.allDeviceIds) {
      const d       = userState.devices.get(id);
      const loc     = d?.location || id;
      const isOff   = userState.activeAlerts.has(`offline_${id}`);
      lines.push(t.deviceLine(id, loc, isOff ? 'offline' : 'online'));
    }
  }

  // Разбиваем на части если много
  const text = lines.join('\n');
  const chunks = [];
  const STEP = 50; // строк за раз
  const lineArr = text.split('\n');
  for (let i = 0; i < lineArr.length; i += STEP) {
    chunks.push(lineArr.slice(i, i + STEP).join('\n'));
  }
  for (const chunk of chunks) {
    await ctx.reply(chunk, { parse_mode: 'Markdown' });
  }
}

// ================================================================
// /alerts — активные проблемы
// ================================================================
async function handleAlerts(ctx) {
  const userState = state.getUser(String(ctx.chat.id));
  if (!userState) return ctx.reply(t.invalidStart, { parse_mode: 'Markdown' });

  if (userState.activeAlerts.size === 0) {
    return ctx.reply(t.noAlerts, { parse_mode: 'Markdown' });
  }

  const lines = [`⚠️ *Активные проблемы (${userState.activeAlerts.size}):*\n`];
  for (const [key, alert] of userState.activeAlerts) {
    const since = dayjs(alert.since).format('DD.MM HH:mm');
    lines.push(`${alert.msg}\n⏱ _с ${since}_`);
    lines.push('──────────────');
  }
  await sender.safeSend(ctx.telegram || ctx, String(ctx.chat.id), lines.join('\n'));
}

// ================================================================
// /report — отчёт за сегодня (on-demand)
// ================================================================
async function handleReport(ctx) {
  const userState = state.getUser(String(ctx.chat.id));
  if (!userState) return ctx.reply(t.invalidStart, { parse_mode: 'Markdown' });

  await ctx.reply('⏳ Запрашиваем данные...');

  const { appid, saler } = userState;
  const today     = dayjs().format('YYYY-MM-DD');
  const beginTime = `${today} 00:00:00`;
  const endTime   = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const allRecords = [];
  let page = 1;
  while (true) {
    const data = await api.getConsumeList(appid, saler, beginTime, endTime, page);
    if (!data || data.code !== 0 || !Array.isArray(data.data) || data.data.length === 0) break;
    allRecords.push(...data.data);
    if (data.data.length < 20) break;
    page++;
  }

  const byDevice = {};
  for (const rec of allRecords) {
    const deviceId = rec.shop_num || rec.card_num;
    const location = rec.location || userState.devices.get(deviceId)?.location || deviceId;
    if (!byDevice[deviceId]) byDevice[deviceId] = { location, liters: 0, amount: 0 };
    byDevice[deviceId].liters += parseFloat(rec.water1 || 0) + parseFloat(rec.water2 || 0);
    byDevice[deviceId].amount += parseFloat(rec.cost_value || rec.value || 0);
  }

  const t2 = require('./locales/' + cfg.locale);
  let totalL = 0, totalA = 0;
  const lines = [t2.reportHeader(today)];

  const entries = Object.values(byDevice);
  if (entries.length === 0) {
    lines.push(t2.reportEmpty);
  } else {
    for (const e of entries) {
      lines.push(t2.reportLine(e.location, e.liters.toFixed(1), e.amount.toFixed(2)));
      totalL += e.liters;
      totalA += e.amount;
    }
    lines.push(t2.reportTotal(totalL.toFixed(1), totalA.toFixed(2)));
  }

  await sender.safeSend({ telegram: ctx.telegram }, String(ctx.chat.id), lines.join('\n'));
}

// ================================================================
// /mute — тишина на 1 час
// ================================================================
async function handleMute(ctx) {
  const userState = state.getUser(String(ctx.chat.id));
  if (!userState) return;
  state.mute(userState, 1);
  await ctx.reply(require('./locales/' + cfg.locale).mutedFor(1), { parse_mode: 'Markdown' });
}

// ================================================================
// /unmute — включить уведомления
// ================================================================
async function handleUnmute(ctx) {
  const userState = state.getUser(String(ctx.chat.id));
  if (!userState) return;
  state.unmute(userState);
  await ctx.reply(require('./locales/' + cfg.locale).unmuted, { parse_mode: 'Markdown' });
}

// ================================================================
// /help
// ================================================================
async function handleHelp(ctx) {
  await ctx.reply(require('./locales/' + cfg.locale).cmdHelp, { parse_mode: 'Markdown' });
}

module.exports = {
  handleStart,
  handleStatus,
  handleDevices,
  handleAlerts,
  handleReport,
  handleMute,
  handleUnmute,
  handleHelp,
};
