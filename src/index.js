// src/index.js — точка входа
'use strict';

require('dotenv').config();

const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const dayjs = require('dayjs');

const cfg = require('./config');
const logger = require('./logger');
const state = require('./services/stateManager');
const monitor = require('./services/monitor');
const sender = require('./services/sender');
const cmds = require('./commands');

// ================================================================
// Инициализация бота
// ================================================================
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

// Кнопки клавиатуры (текстовые команды)
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

// Счётчик для определения 30-минутных интервалов (каждый 3-й запуск = 30 минут)
let cycleCounter = 0;

// Каждые 10 минут
cron.schedule('*/10 * * * *', async () => {
  const users = state.getAllUsers();
  if (users.length === 0) return;

  logger.info(`[CRON] Poll cycle #${cycleCounter} — users: ${users.length}`);

  // QR/продажи проверяем каждые 30 минут (каждый 3-й цикл)
  const shouldRunQrPayments = (cycleCounter % 3 === 0);

  // Запускаем мониторинг для всех пользователей
  for (const u of users) {
    try {
      await monitor.runMonitorCycle(u, {
        checkDeviceDetail: true,
        checkExceptions: true,
        checkQrPayments: shouldRunQrPayments,
      });
    } catch (err) {
      logger.error(`🔥 MONITOR ERROR user=${u.id}`);
      logger.error(err.stack || err);
    }
  }

  cycleCounter++;

  // Отправляем накопленные алерты
  logger.info(`[CRON] Flushing alerts to Telegram`);
  await sender.flushAllAlerts(bot);
});

// ================================================================
// Запуск
// ================================================================
async function main() {
  try {
    if (process.env.RAILWAY_ENVIRONMENT) {
      logger.info('Railway detected - single instance mode');
    }

    logger.info('Starting bot...');

    await bot.telegram.deleteWebhook({
      drop_pending_updates: true
    });

    await bot.launch({
      dropPendingUpdates: true
    });

    logger.info('✅ Bot launched successfully');

  } catch (err) {
    logger.error('🔥 BOT START CRASH');
    logger.error(err.stack || err);
    process.exit(1);
  }
}
process.on('uncaughtException', (err) => {
  logger.error('🔥 uncaughtException');
  logger.error(err.stack || err);
});

process.on('unhandledRejection', (err) => {
  logger.error('🔥 unhandledRejection');
  logger.error(err?.stack || err);
});

main().catch(err => {
  logger.error(`Fatal error: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT', () => { logger.info('SIGINT received'); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { logger.info('SIGTERM received'); bot.stop('SIGTERM'); });