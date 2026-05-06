// src/services/monitor.js
'use strict';

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

// Дефолтная таймзона бота
dayjs.tz.setDefault('Europe/Warsaw');

const cfg = require('../config');
const logger = require('../logger');
const api = require('./apiClient');
const state = require('./stateManager');
const t = require('../locales/' + cfg.locale);

// Wartości "normalne" z API
const NORMAL_VALUES = ['正常', 'normal', 'Normal', ''];

// ================================================================
// Funkcje pomocnicze czasu
// ================================================================
function getWarsawNow() {
  return dayjs().tz('Europe/Warsaw');
}
function fromApiTime(apiTimeStr) {
  if (!apiTimeStr) return null;
  // API zwraca czas w strefie czasowej Chin (UTC+8), konwertujemy do Europe/Warsaw
  return dayjs.tz(apiTimeStr, 'Asia/Shanghai').tz('Europe/Warsaw').format('DD.MM.YYYY HH:mm:ss');
}

/**
 * Konwertuje czas Warszawy na format oczekiwany przez API (UTC+8)
 */
function toApiTime(date) {
  return date.utc().add(8, 'hour').format('YYYY-MM-DD HH:mm:ss');
}

// ================================================================
// GŁÓWNA FUNKCJA — wywoływana co 10 minut dla każdego użytkownika
// ================================================================
async function runMonitorCycle(userState, options = {}) {
  const { skipDailyReport = false, forceRefresh = false } = options;
  const { appid, saler } = userState;
  const now = Date.now();

  try {
    // 1. Aktualizacja listy urządzeń — co 10 minut lub wymuszenie
    if (forceRefresh || now - userState.deviceIdsLastUpdate > 10 * 60 * 1000) {
      await refreshDeviceList(userState);
    }

    // 2. Sprawdzanie wyjątków (offline, woda, ciśnienie itd.) — wymuszenie lub co 10 minut
    if (forceRefresh || !userState._lastExceptionCheck || now - userState._lastExceptionCheck > 10 * 60 * 1000) {
      await checkExceptions(userState);
      userState._lastExceptionCheck = now;
    }

    // 3. Szczegóły urządzeń (temperatura) w batchach
    if (!userState._lastDetailCheck || now - userState._lastDetailCheck > 10 * 60 * 1000) {
      await checkDeviceBatch(userState);
      userState._lastDetailCheck = now;
    }

    // 4. Płatności QR i sprzedaż bez rozlewu — co 30 minut
    if (!userState._lastQrCheck || now - userState._lastQrCheck > 30 * 60 * 1000) {
      await checkQrPayments(userState);
      userState._lastQrCheck = now;
    }

    // 5. Karty SIM — co godzinę
    if (!userState._lastSimCheck || now - userState._lastSimCheck > 60 * 60 * 1000) {
      await checkSimCards(userState);
      userState._lastSimCheck = now;
    }

    // 6. Raport dzienny
    if (!skipDailyReport) {
      await checkDailyReport(userState);
    }

  } catch (err) {
    logger.error(`Monitor cycle error for ${saler}: ${err.message}`);
  }
}

// ================================================================
// 1. Aktualizacja listy urządzeń
// ================================================================
async function refreshDeviceList(userState) {
  const { appid, saler } = userState;
  const allIds = [];

  for (const type of cfg.deviceTypes) {
    const devices = await api.getAllDevices(appid, saler, type);
    for (const d of devices) {
      allIds.push(d.id);
      if (!userState.devices.has(d.id)) {
        userState.devices.set(d.id, { location: d.location || d.id, type });
      } else {
        userState.devices.get(d.id).location = d.location || d.id;
      }
    }
    await api.sleep(cfg.requestDelayMs);
  }

  userState.allDeviceIds = allIds;
  userState.deviceIdsLastUpdate = Date.now();
  logger.info(`[${saler}] Device list updated: ${allIds.length} devices`);
}

// ================================================================
// 2. Sprawdzanie wyjątków (exception-status-query)
// ================================================================
async function checkExceptions(userState) {
  const { appid, saler } = userState;

  for (const type of cfg.deviceTypes) {
    const data = await api.getExceptionDevices(appid, saler, type, 1, 200);
    if (!data || data.code !== 0 || !data.data) continue;

    const items = data.data.items || [];

    for (const item of items) {
      const deviceId = item.deviceId;
      const location = item.name || userState.devices.get(deviceId)?.location || deviceId;
      if (item.lastConnect) {
        const dev = userState.devices.get(deviceId) || {};
        userState.devices.set(deviceId, {
          ...dev,
          location,
          lastConnect: item.lastConnect,
        });
      }
      // ── Status offline ──
      const alertKeyOffline = `offline_${deviceId}`;
      const isOfflineByStatus = item.statusMsg === '离线';

      let diffMin = 0;
      if (item.lastConnect) {
        const lastSeen = dayjs.tz(item.lastConnect, 'YYYY-MM-DD HH:mm:ss', 'Europe/Warsaw');
        diffMin = getWarsawNow().diff(lastSeen, 'minute');
      }

      const isOffline = isOfflineByStatus || diffMin >= cfg.offlineMinutes;

      if (isOffline) {
        const offlineMins = diffMin > 0 ? diffMin : cfg.offlineMinutes;
        state.addAlertToAll(saler, alertKeyOffline, {
          type: 'offline',
          msg: t.alertOffline(deviceId, location, offlineMins, fromApiTime(item.lastConnect)),
        });
      } else {
        state.resolveAlertForAll(saler, alertKeyOffline, t.alertStatusOnline(deviceId, location));
      }

      // ── Poziom wody ──
      const alertKeyWater = `water_level_${deviceId}`;
      if (item.waterLevel && !NORMAL_VALUES.includes(item.waterLevel)) {
        state.addAlertToAll(saler, alertKeyWater, {
          type: 'water_level',
          msg: t.alertWaterLevel(deviceId, location, item.waterLevel, fromApiTime(item.lastConnect))
        });
      } else {
        state.resolveAlertForAll(saler, alertKeyWater, t.alertResolved(deviceId, location, 'water_level'));
      }

      // ── Ciśnienie wody ──
      const alertKeyPressure = `water_pressure_${deviceId}`;
      if (type !== 'shop_water' && item.waterPressure && !NORMAL_VALUES.includes(item.waterPressure)) {
        state.addAlertToAll(saler, alertKeyPressure, {
          type: 'water_pressure',
          msg: t.alertWaterPressure(deviceId, location, item.waterPressure, fromApiTime(item.lastConnect))

        });
      } else {
        state.resolveAlertForAll(saler, alertKeyPressure, t.alertResolved(deviceId, location, 'water_pressure'));
      }

      // ── Niska temperatura ──
      if (item.temp !== undefined && item.temp !== null && item.temp !== '') {
        checkTemp(userState, deviceId, location, parseFloat(item.temp));
      }
    }

    await api.sleep(cfg.requestDelayMs);
  }
}

// ================================================================
// 3. Sprawdzanie temperatury (low / high)
// ================================================================
function checkTemp(userState, deviceId, location, temp) {
  if (isNaN(temp)) return;
  const { saler } = userState;

  const keyLow = `temp_low_${deviceId}`;
  const keyHigh = `temp_high_${deviceId}`;

  if (temp < cfg.tempMin) {
    state.addAlertToAll(saler, keyLow, {
      type: 'temp_low',
      msg: t.alertTempLow(deviceId, location, temp),
    });
  } else {
    state.resolveAlertForAll(saler, keyLow, t.alertResolved(deviceId, location, 'temp_low'));
  }

  if (temp > cfg.tempMax) {
    state.addAlertToAll(saler, keyHigh, {
      type: 'temp_high',
      msg: t.alertTempHigh(deviceId, location, temp),
    });
  } else {
    state.resolveAlertForAll(saler, keyHigh, t.alertResolved(deviceId, location, 'temp_high'));
  }
}

// ================================================================
// 4. Płatności QR i sprzedaż bez rozlewu
// ================================================================
async function checkQrPayments(userState) {
  const { appid, saler } = userState;

  const nowWarsaw = getWarsawNow();
  const beginTime = toApiTime(nowWarsaw.subtract(35, 'minute')); // 30 мин + запас
  const endTime = toApiTime(nowWarsaw);

  logger.info(`[${saler}] QR check: ${beginTime} → ${endTime}`);

  // QR пополнения
  const rechargeData = await api.getRechargeList(appid, saler, beginTime, endTime, 1);
  if (rechargeData?.code === 0 && Array.isArray(rechargeData.data)) {
    for (const rec of rechargeData.data) {
      const payId = rec.alipay_number || rec.key_id;
      if (userState.sentQrPayments.has(payId)) continue;

      userState.sentQrPayments.add(payId);
      const deviceId = rec.device || rec.card_num;
      const location = rec.location || userState.devices.get(deviceId)?.location || deviceId;
      const amount = parseFloat(rec.value || 0).toFixed(2);

      state.addPendingAlertToAll(saler, {
        type: 'qr_payment',
        msg: t.alertQrPayment(deviceId, location, amount, fromApiTime(rec.time)),
      });
    }
  }

  // Продажи без розлива
  const consumeData = await api.getConsumeList(appid, saler, beginTime, endTime, 1);
  if (consumeData?.code === 0 && Array.isArray(consumeData.data)) {
    for (const rec of consumeData.data) {
      const payId = rec.pay_id || rec.key_id;
      const water1 = parseFloat(rec.water1 || 0);
      const water2 = parseFloat(rec.water2 || 0);
      const cost = parseFloat(rec.cost_value || rec.value || 0);

      if (cost > 0 && water1 === 0 && water2 === 0) {
        const noDispKey = `no_dispense_${payId}`;
        if (userState.sentQrPayments.has(noDispKey)) continue;

        userState.sentQrPayments.add(noDispKey);
        const deviceId = rec.shop_num || rec.card_num;
        const location = rec.location || userState.devices.get(deviceId)?.location || deviceId;

        state.addPendingAlertToAll(saler, {
          type: 'no_dispense',
          msg: t.alertNoDispense(deviceId, location, cost.toFixed(2), fromApiTime(rec.time)),
        });
      }
    }
  }


  // Czyszczenie starych zapisów
  if (userState.sentQrPayments.size > 500) {
    const first = userState.sentQrPayments.values().next().value;
    userState.sentQrPayments.delete(first);
  }
}

// ================================================================
// 5. Sprawdzanie kart SIM
// ================================================================
async function checkSimCards(userState) {
  const { appid, saler } = userState;
  const sims = await api.getAllSims(appid, saler);

  for (const sim of sims) {
    const iccid = sim.iccid;
    const deviceId = sim.imei;
    const location = sim.location || userState.devices.get(deviceId)?.location || deviceId;

    if (!sim.valid_date) continue;

    const expireDate = dayjs(sim.valid_date);
    const daysLeft = expireDate.diff(getWarsawNow(), 'day');
    const expireStr = expireDate.format('DD.MM.YYYY');

    const keyExpired = `sim_expired_${iccid}`;
    const keyExpiring = `sim_expiring_${iccid}`;

    if (daysLeft <= 0) {
      state.addAlertToAll(saler, keyExpired, {
        type: 'sim_expired',
        msg: t.alertSimExpired(iccid, location),
      });
    } else if (daysLeft <= cfg.simDaysWarn) {
      state.addAlertToAll(saler, keyExpiring, {
        type: 'sim_expiring',
        msg: t.alertSimExpiring(iccid, location, daysLeft, expireStr),
      });
    } else {
      state.resolveAlertForAll(saler, keyExpired, null);
      state.resolveAlertForAll(saler, keyExpiring, null);
    }
  }
}

// ================================================================
// 6. Raport dzienny
// ================================================================

async function checkDailyReport(userState) {
  const { appid, saler } = userState;
  const now = getWarsawNow();
  const hour = now.hour();
  const date = now.format('YYYY-MM-DD');

  if (hour !== cfg.dailyReportHour) return;
  if (state.getDailyReportSent(saler) === date) return;
  state.setDailyReportSent(saler, date);

  const yesterday = now.subtract(1, 'day');
  const yesterdayStr = yesterday.format('YYYY-MM-DD');

  // Konwertujemy granice dnia po Warsaw → UTC+8 dla API
  const beginTime = toApiTime(yesterday.startOf('day'));
  const endTime = toApiTime(yesterday.endOf('day'));

  logger.info(`[${saler}] Daily report: Warsaw ${yesterdayStr} 00:00–23:59 → API ${beginTime} → ${endTime}`);

  const allRecords = [];
  let page = 1;

  while (true) {
    const data = await api.getConsumeList(appid, saler, beginTime, endTime, page);
    if (!data || data.code !== 0 || !Array.isArray(data.data) || data.data.length === 0) break;
    allRecords.push(...data.data);
    if (data.data.length < 20) break;
    page++;
    await api.sleep(cfg.requestDelayMs);
  }

  const byDevice = {};
  for (const rec of allRecords) {
    const deviceId = rec.shop_num || rec.card_num;
    const location = rec.location || userState.devices.get(deviceId)?.location || deviceId;
    if (!byDevice[deviceId]) byDevice[deviceId] = { location, liters: 0, amount: 0 };
    byDevice[deviceId].liters += parseFloat(rec.water1 || 0) + parseFloat(rec.water2 || 0);
    byDevice[deviceId].amount += parseFloat(rec.cost_value || rec.value || 0);
  }

  let totalLiters = 0, totalAmount = 0;
  let lines = [t.dailyReportHeader(yesterdayStr)];

  const entries = Object.values(byDevice);
  if (entries.length === 0) {
    lines = [t.dailyReportEmpty];
  } else {
    for (const e of entries) {
      lines.push(t.dailyReportLine(e.location, e.liters.toFixed(1), e.amount.toFixed(2)));
      totalLiters += e.liters;
      totalAmount += e.amount;
    }
    lines.push(t.dailyReportTotal(totalLiters.toFixed(1), totalAmount.toFixed(2)));
  }

  state.addPendingAlertToAll(saler, {
    type: 'daily_report',
    isReport: true,
    msg: lines.join('\n'),
  });

  logger.info(`[${saler}] Daily report prepared for ${yesterdayStr}: ${allRecords.length} records`);
}
// ================================================================
// Raporty dzienne dla wszystkich saler (wywoływane raz w cron)
// ================================================================
async function runDailyReportsForAllSalers() {
  const users = state.getAllUsers();
  const processedSalers = new Set();

  for (const userState of users) {
    const { saler } = userState;

    // Pomijamy, jeśli już przetworzono ten saler
    if (processedSalers.has(saler)) continue;
    processedSalers.add(saler);

    try {
      await checkDailyReport(userState);
    } catch (err) {
      logger.error(`🔥 Daily report error for saler=${saler}: ${err.message}`);
    }
  }
}

module.exports = { runMonitorCycle, runDailyReportsForAllSalers };