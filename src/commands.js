'use strict';

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const cfg = require('./config');
const logger = require('./logger');
const api = require('./services/apiClient');
const state = require('./services/stateManager');
const sender = require('./services/sender');
const { checkSubscription } = require('./services/subscriptionChecker');
const t = require('./locales/' + cfg.locale);

// ================================================================
// Утилиты времени
// ================================================================

function getWarsawToday() {
  return dayjs().tz('Europe/Warsaw').format('YYYY-MM-DD');
}

function dayStartWarsaw(dateStr) {
  return dayjs.tz(`${dateStr} 00:00:00`, 'Europe/Warsaw')
    .utc()
    .add(8, 'hour')
    .format('YYYY-MM-DD HH:mm:ss');
}

function dayEndWarsaw(dateStr) {
  return dayjs.tz(`${dateStr} 23:59:59`, 'Europe/Warsaw')
    .utc()
    .add(8, 'hour')
    .format('YYYY-MM-DD HH:mm:ss');
}

// ================================================================
// Проверка подписки
// ================================================================

async function requireSubscription(ctx, userState) {
  const active = await checkSubscription(userState.appid, userState.saler);
  if (!active) {
    await ctx.reply(t.subscriptionExpired, { parse_mode: 'Markdown' });
    return false;
  }
  return true;
}

// ================================================================
// /start
// ================================================================
async function handleStart(ctx) {
  const chatId = String(ctx.chat.id);
  const param = ctx.message?.text?.split(' ')[1] || '';

  logger.info(`/start from ${chatId}, param: ${param}`);

  const existing = state.getUser(chatId);
  if (existing && !param) {
    const active = await checkSubscription(existing.appid, existing.saler);
    if (!active) {
      return ctx.reply(t.subscriptionExpired, { parse_mode: 'Markdown' });
    }
    return ctx.reply(t.alreadyRegistered(existing.saler), { parse_mode: 'Markdown' });
  }

  let appid, saler;

  if (param) {
    const parts = param.split(/_?SALER_/i);
    if (parts.length === 2) {
      appid = parts[0].replace(/^APPID_/i, '').trim();
      saler = parts[1].trim();
    }
  }

  if (!appid || !saler) {
    return ctx.reply(t.invalidStartParam, { parse_mode: 'Markdown' });
  }

  await ctx.reply(t.checkingApi);
  const ok = await api.testAuth(appid, saler);

  if (!ok) {
    return ctx.reply(t.authFailed, { parse_mode: 'Markdown' });
  }

  const active = await checkSubscription(appid, saler);
  if (!active) {
    return ctx.reply(t.subscriptionExpired, { parse_mode: 'Markdown' });
  }

  state.setUser(chatId, appid, saler);
  logger.info(`User registered: chatId=${chatId} saler=${saler}`);

  await ctx.reply(t.welcome(saler), {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        [{ text: '/devices' }, { text: '/alerts' }],
        [{ text: '/report' }, { text: '/mute' }],
        [{ text: '/unmute' }, { text: '/help' }],
      ],
      resize_keyboard: true,
    },
  });
}

// ================================================================
// /status
// ================================================================
async function handleStatus(ctx) {
  const userState = state.getUser(String(ctx.chat.id));
  if (!userState) return ctx.reply(t.invalidStart, { parse_mode: 'Markdown' });
  if (!await requireSubscription(ctx, userState)) return;

  const total = userState.allDeviceIds.length;
  const alerts = userState.activeAlerts.size;

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
    `🏪 ${t.accountLabel}: \`${userState.saler}\``,
    `🕐 ${t.updatedLabel}: ${dayjs().format('DD.MM HH:mm')}`,
  ];

  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}

// ================================================================
// /devices
// ================================================================
async function handleDevices(ctx) {
  const userState = state.getUser(String(ctx.chat.id));
  if (!userState) return ctx.reply(t.invalidStart, { parse_mode: 'Markdown' });
  if (!await requireSubscription(ctx, userState)) return;

  await ctx.reply('🔄', { parse_mode: 'Markdown' });

  const monitor = require('./services/monitor');
  try {
    await monitor.runMonitorCycle(userState, {
      checkDeviceDetail: true,
      checkExceptions: true,
      checkQrPayments: false,
      skipDailyReport: true,
      forceRefresh: true,
    });
  } catch (err) {
    logger.error(`Error in devices command: ${err.message}`);
  }

  // Сбрасываем pendingAlerts чтобы не задвоились в следующем flush
  state.flushPendingAlerts(userState);

  const onlineList = [];
  const offlineList = [];

  for (const id of userState.allDeviceIds) {
    const d = userState.devices.get(id);
    const loc = d?.location || id;
    const isOff = userState.activeAlerts.has(`offline_${id}`);
    const lastConn = d?.lastConnect
    ? `(${dayjs.tz(d.lastConnect, 'Asia/Shanghai').tz('Europe/Warsaw').format('DD.MM HH:mm')})`
    : '';
    const entry = `${id} — ${loc} ${lastConn}`;
    if (isOff) {
      offlineList.push(`🔴 ${entry}`);
    } else {
      onlineList.push(`🟢 ${entry}`);
    }
  }

  const total = userState.allDeviceIds.length;
  const lines = [
    `📊 *Онлайн ${onlineList.length} / Офлайн ${offlineList.length} / Всего ${total}*`,
    '',
  ];

  if (total === 0) {
    lines.push(t.devicesEmpty);
  } else {
    if (offlineList.length > 0) {
      lines.push('*🔴 Нет связи:*');
      lines.push(...offlineList);
      if (onlineList.length > 0) lines.push('');
    }
    if (onlineList.length > 0) {
      lines.push('*🟢 Онлайн:*');
      lines.push(...onlineList);
    }
  }

  const text = lines.join('\n');
  const STEP = 50;
  const lineArr = text.split('\n');

  for (let i = 0; i < lineArr.length; i += STEP) {
    await ctx.reply(lineArr.slice(i, i + STEP).join('\n'), {
      parse_mode: 'Markdown',
    });
  }
}

// ================================================================
// /alerts
// ================================================================
async function handleAlerts(ctx) {
  const userState = state.getUser(String(ctx.chat.id));
  if (!userState) return ctx.reply(t.invalidStart, { parse_mode: 'Markdown' });
  if (!await requireSubscription(ctx, userState)) return;

  await ctx.reply(t.checkingState);

  const monitor = require('./services/monitor');
  try {
    await monitor.runMonitorCycle(userState, {
      checkDeviceDetail: true,
      checkExceptions: true,
      checkQrPayments: false,
      skipDailyReport: true,
      forceRefresh: true,
    });
  } catch (err) {
    logger.error(`Error in alerts command: ${err.message}`);
    return ctx.reply(t.errorCheckingState, { parse_mode: 'Markdown' });
  }

  // Сбрасываем pendingAlerts чтобы не задвоились в следующем flush
  state.flushPendingAlerts(userState);

  if (userState.activeAlerts.size === 0) {
    return ctx.reply(t.noProblems, { parse_mode: 'Markdown' });
  }

  const lines = [`⚠️ *${t.currentProblems(userState.activeAlerts.size)}*\n`];

  for (const [key, alert] of userState.activeAlerts) {
    const since = dayjs(alert.since).format('DD.MM HH:mm');
    lines.push(`${alert.msg}\n⏱ _${t.sinceLabel} ${since}_`);
    lines.push('──────────────');
  }

  await sender.safeSend({ telegram: ctx.telegram }, String(ctx.chat.id), lines.join('\n'));
}

// ================================================================
// /report
// ================================================================
async function handleReport(ctx) {
  const userState = state.getUser(String(ctx.chat.id));
  if (!userState) return ctx.reply(t.invalidStart, { parse_mode: 'Markdown' });
  if (!await requireSubscription(ctx, userState)) return;

  await ctx.reply(t.fetchingData);

  const { appid, saler } = userState;

  const todayStr = getWarsawToday();
  const beginTime = dayStartWarsaw(todayStr);
  const endTime = dayEndWarsaw(todayStr);

  logger.info(`[Report] ${todayStr} | ${beginTime} - ${endTime}`);

  const allRecords = [];
  let page = 1;

  while (true) {
    const data = await api.getConsumeList(appid, saler, beginTime, endTime, page);
    if (!data || data.code !== 0 || !data.data?.length) break;
    allRecords.push(...data.data);
    if (data.data.length < 20) break;
    page++;
  }

  const byDevice = {};

  for (const rec of allRecords) {
    const deviceId = rec.shop_num || rec.card_num || rec.device;
    if (!deviceId) continue;

    const location = rec.location || userState.devices.get(deviceId)?.location || deviceId;

    if (!byDevice[deviceId]) {
      byDevice[deviceId] = { location, liters: 0, amount: 0 };
    }

    byDevice[deviceId].liters += parseFloat(rec.water1 || 0) + parseFloat(rec.water2 || 0);
    byDevice[deviceId].amount += parseFloat(rec.cost_value || rec.value || 0);
  }

  let totalL = 0, totalA = 0;
  const lines = [t.reportHeader(todayStr)];
  const entries = Object.values(byDevice);

  if (!entries.length) {
    lines.push(t.reportEmpty);
  } else {
    for (const e of entries) {
      lines.push(`${e.location} — ${e.liters.toFixed(1)} L — ${e.amount.toFixed(2)} zł`);
      totalL += e.liters;
      totalA += e.amount;
    }
    lines.push(t.reportTotal(totalL.toFixed(1), totalA.toFixed(2)));
  }

  await sender.safeSend({ telegram: ctx.telegram }, String(ctx.chat.id), lines.join('\n'));
}

// ================================================================
// /mute
// ================================================================
async function handleMute(ctx) {
  const userState = state.getUser(String(ctx.chat.id));
  if (!userState) return;
  if (!await requireSubscription(ctx, userState)) return;

  state.mute(userState, 1);
  await ctx.reply(t.mutedFor(1), { parse_mode: 'Markdown' });
}

// ================================================================
// /unmute
// ================================================================
async function handleUnmute(ctx) {
  const userState = state.getUser(String(ctx.chat.id));
  if (!userState) return;
  if (!await requireSubscription(ctx, userState)) return;

  state.unmute(userState);
  await ctx.reply(t.unmuted, { parse_mode: 'Markdown' });
}

// ================================================================
// /help
// ================================================================
async function handleHelp(ctx) {
  await ctx.reply(t.cmdHelp, { parse_mode: 'Markdown' });
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