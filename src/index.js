// src/index.js — точка входа
'use strict';

require('dotenv').config();

const { Telegraf } = require('telegraf');
const cron         = require('node-cron');
const dayjs        = require('dayjs');

const cfg     = require('./config');
const logger  = require('./logger');
const state   = require('./services/stateManager');
const monitor = require('./services/monitor');
const sender  = require('./services/sender');
const cmds    = require('./commands');

// ================================================================
// Инициализация бота
// ================================================================
const bot = new Telegraf(cfg.botToken);

// ---- Команды ----
bot.start(cmds.handleStart);
bot.command('status',  cmds.handleStatus);
bot.command('devices', cmds.handleDevices);
bot.command('alerts',  cmds.handleAlerts);
bot.command('report',  cmds.handleReport);
bot.command('mute',    cmds.handleMute);
bot.command('unmute',  cmds.handleUnmute);
bot.command('help',    cmds.handleHelp);

// Кнопки клавиатуры (текстовые команды)
bot.hears('/status',  cmds.handleStatus);
bot.hears('/devices', cmds.handleDevices);
bot.hears('/alerts',  cmds.handleAlerts);
bot.hears('/report',  cmds.handleReport);
bot.hears('/mute',    cmds.handleMute);
bot.hears('/unmute',  cmds.handleUnmute);
bot.hears('/help',    cmds.handleHelp);

bot.on('message', (ctx) => {
  const text = ctx.message?.text || '';
  if (!text.startsWith('/')) return; // игнорируем обычный текст
  ctx.reply(require('./locales/' + cfg.locale).cmdUnknown, { parse_mode: 'Markdown' });
});

// ================================================================
// Планировщик мониторинга
// ================================================================

// Счётчик минут для определения когда слать алерты
let minuteCounter = 0;
const ALERT_EVERY_N_MINUTES = Math.round(cfg.alertIntervalSec / cfg.pollIntervalSec);

// Каждую минуту — опрос API для всех пользователей
cron.schedule('* * * * *', async () => {
  const users = state.getAllUsers();
  if (users.length === 0) return;

  logger.info(`[CRON] Poll tick #${minuteCounter} — users: ${users.length}`);

  // Запускаем мониторинг параллельно для всех пользователей
  await Promise.all(users.map(u => monitor.runMonitorCycle(u)));

  minuteCounter++;

  // Каждые N минут отправляем накопленные алерты
  if (minuteCounter % ALERT_EVERY_N_MINUTES === 0) {
    logger.info(`[CRON] Flushing alerts to Telegram`);
    await sender.flushAllAlerts(bot);
  }
});

// ================================================================
// Запуск
// ================================================================
async function main() {
  logger.info('='.repeat(50));
  logger.info('🤖 Watermat Monitor Bot starting...');
  logger.info(`📍 Locale: ${cfg.locale.toUpperCase()}`);
  logger.info(`⏱  Poll interval: ${cfg.pollIntervalSec}s`);
  logger.info(`📤 Alert interval: ${cfg.alertIntervalSec}s (every ${ALERT_EVERY_N_MINUTES} polls)`);
  logger.info(`📦 Batch size: ${cfg.batchSize}`);
  logger.info('='.repeat(50));

  await bot.launch();
  logger.info('✅ Bot launched successfully');
  logger.info(`🔗 Start link format: https://t.me/<BOT_USERNAME>?start=APPID_<appid>_SALER_<saler>`);
}

main().catch(err => {
  logger.error(`Fatal error: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT',  () => { logger.info('SIGINT received'); bot.stop('SIGINT');  });
process.once('SIGTERM', () => { logger.info('SIGTERM received'); bot.stop('SIGTERM'); });
