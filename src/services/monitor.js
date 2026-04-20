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

// Значения "нормально" из API
const NORMAL_VALUES = ['正常', 'normal', 'Normal', ''];

// ================================================================
// Вспомогательные функции времени
// ================================================================
function getWarsawNow() {
  return dayjs().tz('Europe/Warsaw');
}

/**
 * Конвертирует время Варшавы в формат, который ожидает API (UTC+8)
 */
function toApiTime(date) {
  return date.utc().add(8, 'hour').format('YYYY-MM-DD HH:mm:ss');
}

// ================================================================
// ОСНОВНАЯ ФУНКЦИЯ — вызывается каждые 10 минут для каждого пользователя
// ================================================================
async function runMonitorCycle(userState) {
  const { appid, saler } = userState;
  const now = Date.now();

  try {
    // 1. Обновление списка устройств — раз в 10 минут
    if (now - userState.deviceIdsLastUpdate > 10 * 60 * 1000) {
      await refreshDeviceList(userState);
    }

    // 2. Проверка исключений (оффлайн, вода, давление и т.д.)
    if (!userState._lastExceptionCheck || now - userState._lastExceptionCheck > 10 * 60 * 1000) {
      await checkExceptions(userState);
      userState._lastExceptionCheck = now;
    }

    // 3. Детали устройств (температура) батчами
    if (!userState._lastDetailCheck || now - userState._lastDetailCheck > 10 * 60 * 1000) {
      await checkDeviceBatch(userState);
      userState._lastDetailCheck = now;
    }

    // 4. QR платежи и продажи без розлива — каждые 30 минут
    if (!userState._lastQrCheck || now - userState._lastQrCheck > 30 * 60 * 1000) {
      await checkQrPayments(userState);
      userState._lastQrCheck = now;
    }

    // 5. SIM карты — раз в час
    if (!userState._lastSimCheck || now - userState._lastSimCheck > 60 * 60 * 1000) {
      await checkSimCards(userState);
      userState._lastSimCheck = now;
    }

    // 6. Ежедневный отчёт
    await checkDailyReport(userState);

  } catch (err) {
    logger.error(`Monitor cycle error for ${saler}: ${err.message}`);
  }
}

// ================================================================
// 1. Обновление списка устройств
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
// 2. Проверка исключений (exception-status-query)
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
      // ── Оффлайн ──
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
          msg: t.alertOffline(deviceId, location, offlineMins),
        });
      } else {
        state.resolveAlertForAll(saler, alertKeyOffline, t.alertStatusOnline(deviceId, location));
      }

      // ── Уровень воды ──
      const alertKeyWater = `water_level_${deviceId}`;
      if (item.waterLevel && !NORMAL_VALUES.includes(item.waterLevel)) {
        state.addAlertToAll(saler, alertKeyWater, {
          type: 'water_level',
          msg: t.alertWaterLevel(deviceId, location, item.waterLevel),
        });
      } else {
        state.resolveAlertForAll(saler, alertKeyWater, t.alertResolved(deviceId, location, 'water_level'));
      }

      // ── Давление воды ──
      const alertKeyPressure = `water_pressure_${deviceId}`;
      if (type !== 'shop_water' && item.waterPressure && !NORMAL_VALUES.includes(item.waterPressure)) {
        state.addAlertToAll(saler, alertKeyPressure, {
          type: 'water_pressure',
          msg: t.alertWaterPressure(deviceId, location, item.waterPressure),
        });
      } else {
        state.resolveAlertForAll(saler, alertKeyPressure, t.alertResolved(deviceId, location, 'water_pressure'));
      }

      // ── Температура из exception ──
      if (item.temp !== undefined && item.temp !== null && item.temp !== '') {
        checkTemp(userState, deviceId, location, parseFloat(item.temp));
      }
    }

    await api.sleep(cfg.requestDelayMs);
  }
}

// ================================================================
// 3. Батчевый опрос деталей устройств (температура)
// ================================================================
async function checkDeviceBatch(userState) {
  const { appid, saler } = userState;
  const ids = userState.allDeviceIds;
  if (ids.length === 0) return;

  const offset = userState.batchOffset;
  const batch = ids.slice(offset, offset + cfg.batchSize);

  userState.batchOffset = (offset + cfg.batchSize) >= ids.length ? 0 : offset + cfg.batchSize;

  for (const deviceId of batch) {
    const resp = await api.getDeviceDetail(appid, saler, deviceId);
    if (!resp || resp.code !== 0 || !resp.data) {
      await api.sleep(cfg.requestDelayMs);
      continue;
    }

    const d = resp.data;
    const location = d.location || userState.devices.get(deviceId)?.location || deviceId;

    userState.devices.set(deviceId, {
      ...(userState.devices.get(deviceId) || {}),
      location,
      lastDetail: d,
    });

    if (d.temp !== undefined && d.temp !== null && d.temp !== '') {
      checkTemp(userState, deviceId, location, parseFloat(d.temp));
    }

    await api.sleep(cfg.requestDelayMs);
  }
}

// ================================================================
// Проверка температуры (low / high)
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
// 4. QR платежи и продажи без розлива
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
        msg: t.alertQrPayment(deviceId, location, amount),
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
          msg: t.alertNoDispense(deviceId, location, cost.toFixed(2)),
        });
      }
    }
  }

  // Очистка старых записей
  if (userState.sentQrPayments.size > 500) {
    const first = userState.sentQrPayments.values().next().value;
    userState.sentQrPayments.delete(first);
  }
}

// ================================================================
// 5. SIM карты
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
// 6. Ежедневный отчёт
// ================================================================
async function checkDailyReport(userState) {
  const { appid, saler } = userState;
  const now = getWarsawNow();
  const hour = now.hour();
  const date = now.format('YYYY-MM-DD');

  if (hour !== cfg.dailyReportHour) return;
  if (userState.lastDailyReportDate === date) return;

  userState.lastDailyReportDate = date;

  const yesterday = now.subtract(1, 'day').format('YYYY-MM-DD');
  const beginTime = `${yesterday} 00:00:00`;
  const endTime = `${yesterday} 23:59:59`;

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
  let lines = [t.dailyReportHeader(yesterday)];

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

  logger.info(`[${saler}] Daily report prepared for ${yesterday}`);
}

module.exports = { runMonitorCycle };