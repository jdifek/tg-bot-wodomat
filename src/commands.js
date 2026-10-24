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
const reports = require('./services/reports');

// const MAIN_KEYBOARD = {
//   keyboard: [
//     [{ text: reports.BTN_DEVICES }, { text: reports.BTN_ALERTS }],
//     [{ text: reports.BTN_REPORT }, { text: reports.BTN_10 }, { text: reports.BTN_30 }],
//   ],
//   resize_keyboard: true,
// };

const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: reports.BTN_DEVICES }, { text: reports.BTN_ALERTS }],
    [{ text: reports.BTN_REPORT }],
  ],
  resize_keyboard: true,
};
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
    return ctx.reply(t.alreadyRegistered(existing.saler), {
      parse_mode: 'Markdown',
      reply_markup: MAIN_KEYBOARD,
    });  }

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
    reply_markup: MAIN_KEYBOARD,
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
    t.totalDevices(total),
    t.devicesOnline(onlineList.length),
    t.devicesOffline(offlineList.length),
    '',
  ];

  if (total === 0) {
    lines.push(t.devicesEmpty);
  } else {
    if (offlineList.length > 0) {
      lines.push(t.statusOffline);
      lines.push(...offlineList);
      if (onlineList.length > 0) lines.push('');
    }
    if (onlineList.length > 0) {
      lines.push(t.statusOnline);
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

  const todayStr = reports.today();
  const data = await reports.fetchReport(userState.appid, userState.saler, todayStr, todayStr);
  if (!data) return ctx.reply(reports.W.fail);

  const header = t.reportHeader(todayStr);
  let text = reports.formatReport(header, data);
  if (!data.complete) text += `\n\n⚠️ ${reports.W.partial}`;

  await sender.safeSend({ telegram: ctx.telegram }, String(ctx.chat.id), text);
}
async function handleReportRange(ctx, days) {
  const userState = state.getUser(String(ctx.chat.id));
  if (!userState) return ctx.reply(t.invalidStart, { parse_mode: 'Markdown' });
  if (!await requireSubscription(ctx, userState)) return;

  await ctx.reply(t.fetchingData);

  const r = reports.lastDays(days);
  const data = await reports.fetchReport(userState.appid, userState.saler, r.from, r.to);
  if (!data) return ctx.reply(reports.W.fail);

  let text = reports.formatReport(reports.rangeHeader(days, r), data);
  if (!data.complete) text += `\n\n⚠️ ${reports.W.partial}`;

  await sender.safeSend({ telegram: ctx.telegram }, String(ctx.chat.id), text);
}

const handleReport10 = (ctx) => handleReportRange(ctx, 10);
const handleReport30 = (ctx) => handleReportRange(ctx, 30);
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
  handleReport10,
  handleReport30,
  handleMute,
  handleUnmute,
  handleHelp,
};