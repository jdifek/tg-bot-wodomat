// src/services/monitor.js
// Вся логика проверок аппаратов и формирования алертов
'use strict';

const dayjs  = require('dayjs');
const cfg    = require('../config');
const logger = require('../logger');
const api    = require('./apiClient');
const state  = require('./stateManager');
const t      = require('../locales/' + cfg.locale);

// ================================================================
// ОСНОВНАЯ ФУНКЦИЯ — вызывается каждую минуту для каждого юзера
// ================================================================
async function runMonitorCycle(userState) {
  const { appid, saler } = userState;

  try {
    // 1. Обновляем список всех устройств раз в 10 минут
    if (Date.now() - userState.deviceIdsLastUpdate > 10 * 60 * 1000) {
      await refreshDeviceList(userState);
    }

    // 2. Быстрые проверки через exception-status-query (1 запрос на тип)
    await checkExceptions(userState);

    // 3. Детальный опрос батча аппаратов (температура и т.д.)
    await checkDeviceBatch(userState);

    // 4. Проверка QR платежей
    await checkQrPayments(userState);

    // 5. Проверка SIM карт (раз в час)
    if (!userState._lastSimCheck || Date.now() - userState._lastSimCheck > 60 * 60 * 1000) {
      await checkSimCards(userState);
      userState._lastSimCheck = Date.now();
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
      // Кэшируем location
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
// 2. Проверка через exception-status-query
// ================================================================
async function checkExceptions(userState) {
  const { appid, saler } = userState;

  for (const type of cfg.deviceTypes) {
    const data = await api.getExceptionDevices(appid, saler, type, 1, 200);
    if (!data || data.code !== 0 || !data.data) continue;

    const items = data.data.items || [];

    // Текущие проблемные устройства из API
    const currentProblemIds = new Set();

    for (const item of items) {
      const deviceId = item.deviceId;
      const location = item.name || userState.devices.get(deviceId)?.location || deviceId;
      currentProblemIds.add(deviceId);

      // -- Оффлайн --
      if (item.lastConnect) {
        const lastSeen   = dayjs(item.lastConnect);
        const diffMin    = dayjs().diff(lastSeen, 'minute');
        const alertKey   = `offline_${deviceId}`;

        if (diffMin >= cfg.offlineMinutes) {
          state.setAlert(userState, alertKey, {
            type: 'offline',
            msg:  t.alertOffline(deviceId, location, diffMin),
          });
        } else {
          // Был оффлайн — теперь снова онлайн
          if (userState.activeAlerts.has(alertKey)) {
            state.resolveAlert(userState, alertKey, t.alertStatusOnline(deviceId, location));
          }
        }
      }

      // -- Уровень воды --
      if (item.waterLevel && item.waterLevel !== '正常' && item.waterLevel !== 'normal') {
        const alertKey = `water_level_${deviceId}`;
        state.setAlert(userState, alertKey, {
          type: 'water_level',
          msg:  t.alertWaterLevel(deviceId, location, item.waterLevel),
        });
      } else {
        state.resolveAlert(userState, `water_level_${deviceId}`,
          t.alertResolved(deviceId, location, 'water_level'));
      }

      // -- Давление воды (только для shop и shop_liquid, не для shop_water) --
      if (type !== 'shop_water' && item.waterPressure &&
          item.waterPressure !== '正常' && item.waterPressure !== 'normal') {
        const alertKey = `water_pressure_${deviceId}`;
        state.setAlert(userState, alertKey, {
          type: 'water_pressure',
          msg:  t.alertWaterPressure(deviceId, location, item.waterPressure),
        });
      } else {
        state.resolveAlert(userState, `water_pressure_${deviceId}`,
          t.alertResolved(deviceId, location, 'water_pressure'));
      }

      // -- Температура (если передаётся в exception) --
      if (item.temp !== undefined && item.temp !== null && item.temp !== '') {
        checkTemp(userState, deviceId, location, parseFloat(item.temp));
      }
    }

    // Устройства которые пропали из exception-списка = проблема решена
    for (const [key] of userState.activeAlerts) {
      if (!key.startsWith('offline_') && !key.startsWith('water_')) continue;
      const dId = key.split('_').pop();
      if (!currentProblemIds.has(dId)) {
        // Уже не в списке проблем
      }
    }

    await api.sleep(cfg.requestDelayMs);
  }
}

// ================================================================
// 3. Батчевый опрос 3.3.4 (температура, детали)
// ================================================================
async function checkDeviceBatch(userState) {
  const { appid, saler } = userState;
  const ids = userState.allDeviceIds;
  if (ids.length === 0) return;

  // Берём следующий батч
  const offset = userState.batchOffset;
  const batch  = ids.slice(offset, offset + cfg.batchSize);

  // Сдвигаем офсет
  userState.batchOffset = (offset + cfg.batchSize) >= ids.length
    ? 0
    : offset + cfg.batchSize;

  for (const deviceId of batch) {
    const resp = await api.getDeviceDetail(appid, saler, deviceId);
    if (!resp || resp.code !== 0 || !resp.data) {
      await api.sleep(cfg.requestDelayMs);
      continue;
    }
    const d        = resp.data;
    const location = d.location || userState.devices.get(deviceId)?.location || deviceId;

    // Обновляем кэш
    userState.devices.set(deviceId, {
      ...(userState.devices.get(deviceId) || {}),
      location,
      lastDetail: d,
    });

    // -- Температура --
    if (d.temp !== undefined && d.temp !== null && d.temp !== '') {
      checkTemp(userState, deviceId, location, parseFloat(d.temp));
    }

    await api.sleep(cfg.requestDelayMs);
  }
}

// ================================================================
// Вспомогательная: проверка температуры
// ================================================================
function checkTemp(userState, deviceId, location, temp) {
  if (isNaN(temp)) return;

  const keyLow  = `temp_low_${deviceId}`;
  const keyHigh = `temp_high_${deviceId}`;

  if (temp < cfg.tempMin) {
    state.setAlert(userState, keyLow, {
      type: 'temp_low',
      msg:  t.alertTempLow(deviceId, location, temp),
    });
  } else {
    state.resolveAlert(userState, keyLow,
      t.alertResolved(deviceId, location, 'temp_low'));
  }

  if (temp > cfg.tempMax) {
    state.setAlert(userState, keyHigh, {
      type: 'temp_high',
      msg:  t.alertTempHigh(deviceId, location, temp),
    });
  } else {
    state.resolveAlert(userState, keyHigh,
      t.alertResolved(deviceId, location, 'temp_high'));
  }
}

// ================================================================
// 4. Проверка QR пополнений и продаж без розлива
// ================================================================
async function checkQrPayments(userState) {
  const { appid, saler } = userState;

  // Последние 15 минут
  const endTime   = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const beginTime = dayjs().subtract(15, 'minute').format('YYYY-MM-DD HH:mm:ss');

  // QR пополнения
  const rechargeData = await api.getRechargeList(appid, saler, beginTime, endTime, 1);
  if (rechargeData && rechargeData.code === 0 && Array.isArray(rechargeData.data)) {
    for (const rec of rechargeData.data) {
      const payId    = rec.alipay_number || rec.key_id;
      const deviceId = rec.device || rec.card_num;
      const location = rec.location || userState.devices.get(deviceId)?.location || deviceId;
      const amount   = parseFloat(rec.value || 0).toFixed(2);

      if (!userState.sentQrPayments.has(payId)) {
        userState.sentQrPayments.add(payId);
        // Не добавляем как activeAlert, просто уведомление
        userState.pendingAlerts.push({
          type: 'qr_payment',
          msg:  t.alertQrPayment(deviceId, location, amount),
        });
        // Очищаем старые записи (хранить не более 500)
        if (userState.sentQrPayments.size > 500) {
          const iter = userState.sentQrPayments.values();
          userState.sentQrPayments.delete(iter.next().value);
        }
      }
    }
  }

  // Продажи без розлива: оплата прошла (status=finished) но water1=0 и water2=0
  const consumeData = await api.getConsumeList(appid, saler, beginTime, endTime, 1);
  if (consumeData && consumeData.code === 0 && Array.isArray(consumeData.data)) {
    for (const rec of consumeData.data) {
      const payId  = rec.pay_id || rec.key_id;
      const water1 = parseFloat(rec.water1 || 0);
      const water2 = parseFloat(rec.water2 || 0);
      const cost   = parseFloat(rec.cost_value || rec.value || 0);

      // Продажа без розлива: деньги списаны, воды не выдано
      if (cost > 0 && water1 === 0 && water2 === 0) {
        const noDispKey = `no_dispense_${payId}`;
        if (!userState.sentQrPayments.has(noDispKey)) {
          userState.sentQrPayments.add(noDispKey);
          const deviceId = rec.shop_num || rec.card_num;
          const location = rec.location || userState.devices.get(deviceId)?.location || deviceId;
          const amount   = cost.toFixed(2);
          userState.pendingAlerts.push({
            type: 'no_dispense',
            msg:  t.alertNoDispense(deviceId, location, amount),
          });
        }
      }
    }
  }
}

// ================================================================
// 5. Проверка SIM карт
// ================================================================
async function checkSimCards(userState) {
  const { appid, saler } = userState;
  const sims = await api.getAllSims(appid, saler);

  for (const sim of sims) {
    const iccid    = sim.iccid;
    const deviceId = sim.imei;
    const location = sim.location || userState.devices.get(deviceId)?.location || deviceId;

    if (!sim.valid_date) continue;

    const expireDate = dayjs(sim.valid_date);
    const daysLeft   = expireDate.diff(dayjs(), 'day');
    const expireStr  = expireDate.format('DD.MM.YYYY');

    const keyExpired  = `sim_expired_${iccid}`;
    const keyExpiring = `sim_expiring_${iccid}`;

    if (daysLeft <= 0) {
      state.setAlert(userState, keyExpired, {
        type: 'sim_expired',
        msg:  t.alertSimExpired(iccid, location),
      });
    } else if (daysLeft <= cfg.simDaysWarn) {
      state.setAlert(userState, keyExpiring, {
        type: 'sim_expiring',
        msg:  t.alertSimExpiring(iccid, location, daysLeft, expireStr),
      });
    } else {
      state.resolveAlert(userState, keyExpired, null);
      state.resolveAlert(userState, keyExpiring, null);
    }
  }
}

// ================================================================
// 6. Ежедневный отчёт
// ================================================================
async function checkDailyReport(userState) {
  const { appid, saler } = userState;
  const now  = dayjs();
  const hour = now.hour();
  const date = now.format('YYYY-MM-DD');

  if (hour !== cfg.dailyReportHour) return;
  if (userState.lastDailyReportDate === date) return;
  userState.lastDailyReportDate = date;

  const yesterday  = now.subtract(1, 'day').format('YYYY-MM-DD');
  const beginTime  = `${yesterday} 00:00:00`;
  const endTime    = `${yesterday} 23:59:59`;

  // Собираем все страницы
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

  // Группируем по устройству
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

  userState.pendingAlerts.push({
    type:    'daily_report',
    isReport: true,
    msg:     lines.join('\n'),
  });

  logger.info(`[${saler}] Daily report prepared for ${yesterday}`);
}

module.exports = { runMonitorCycle };
