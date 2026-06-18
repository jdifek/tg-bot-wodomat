'use strict';

require('dotenv').config();

const { Telegraf } = require('telegraf');
const cron = require('node-cron');

const cfg = require('./config');
const logger = require('./logger');
const state = require('./services/stateManager');
const monitor = require('./services/monitor');
const sender = require('./services/sender');
const cmds = require('./commands');
const { checkSubscription } = require('./services/subscriptionChecker');
const { acquireLock, releaseLock } = require('./lockfile');

const bot = new Telegraf(cfg.botToken);

bot.catch((err, ctx) => {
  logger.error('🔥 TELEGRAM ERROR');
  logger.error(err.stack || err);
});

bot.use(async (ctx, next) => {
  try {
    return await next();
  } catch (err) {
    logger.error('🔥 MIDDLEWARE ERROR');
    logger.error(err.stack || err);
  }
});

// ---- Команды ----
bot.start(cmds.handleStart);
bot.command('status', cmds.handleStatus);
bot.command('devices', cmds.handleDevices);
bot.command('alerts', cmds.handleAlerts);
bot.command('report', cmds.handleReport);
bot.command('mute', cmds.handleMute);
bot.command('unmute', cmds.handleUnmute);
bot.command('help', cmds.handleHelp);

// Кнопки клавиатуры
bot.hears('/status', cmds.handleStatus);
bot.hears('/devices', cmds.handleDevices);
bot.hears('/alerts', cmds.handleAlerts);
bot.hears('/report', cmds.handleReport);
bot.hears('/mute', cmds.handleMute);
bot.hears('/unmute', cmds.handleUnmute);
bot.hears('/help', cmds.handleHelp);

bot.on('message', (ctx) => {
  const text = ctx.message?.text || '';
  if (!text.startsWith('/')) return;
  ctx.reply(require('./locales/' + cfg.locale).cmdUnknown, { parse_mode: 'Markdown' });
});

// ================================================================
// Планировщик мониторинга
// ================================================================

let cycleCounter = 0;

cron.schedule('*/5 * * * *', async () => {
  const users = state.getAllUsers();
  if (users.length === 0) return;

  logger.info(`[CRON] Poll cycle #${cycleCounter} — users: ${users.length}`);

  const shouldRunQrPayments = (cycleCounter % 6 === 0); // каждые 30 мин = 6 циклов по 5 мин

  for (const u of users) {
    try {
      const active = await checkSubscription(u.appid, u.saler);
      if (!active) {
        logger.warn(`[CRON] Subscription inactive — saler=${u.saler}, skipping monitoring`);
        continue;
      }

      await monitor.runMonitorCycle(u, {
        checkDeviceDetail: true,
        checkExceptions: true,
        checkQrPayments: shouldRunQrPayments,
        skipDailyReport: true,
      });
    } catch (err) {
      logger.error(`🔥 MONITOR ERROR user=${u.id}`);
      logger.error(err.stack || err);
    }
  }

  await monitor.runDailyReportsForAllSalers();

  cycleCounter++;

  logger.info(`[CRON] Flushing alerts to Telegram`);
  await sender.flushAllAlerts(bot);
});

// ================================================================
// Запуск
// ================================================================
async function main() {
  if (!acquireLock()) {
    logger.error('❌ Another bot instance is already running. Exiting.');
    process.exit(0);
  }

  try {
    if (process.env.RAILWAY_ENVIRONMENT) {
      logger.info('Railway detected - single instance mode');
      logger.info('Waiting 10 seconds for previous instance to terminate...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    logger.info('Starting bot...');

    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      logger.info('Webhook deleted successfully');
    } catch (err) {
      logger.warn('Failed to delete webhook: ' + err.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    logger.info('Launching bot with polling...');
    await bot.launch({ dropPendingUpdates: true });

    logger.info('✅ Bot launched successfully');

  } catch (err) {
    logger.error('🔥 BOT START CRASH');
    logger.error(err.stack || err);
    releaseLock();
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  logger.error('🔥 uncaughtException');
  logger.error(err.stack || err);
  releaseLock();
});

process.on('unhandledRejection', (err) => {
  logger.error('🔥 unhandledRejection');
  logger.error(err?.stack || err);
  releaseLock();
});

process.once('SIGINT', () => {
  logger.info('SIGINT received');
  releaseLock();
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  logger.info('SIGTERM received');
  releaseLock();
  bot.stop('SIGTERM');
});

main().catch(err => {
  logger.error(`Fatal error: ${err.message}`);
  releaseLock();
  process.exit(1);
});