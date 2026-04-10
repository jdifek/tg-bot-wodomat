// src/config.js — загрузка конфигурации из .env
'use strict';

require('dotenv').config();

const cfg = {
  botToken:       process.env.BOT_TOKEN,
  locale:         (process.env.LOCALE || 'ru').toLowerCase(),
  apiBaseUrl:     process.env.API_BASE_URL || 'http://api.happy-ti.com:2028',

  batchSize:      parseInt(process.env.BATCH_SIZE       || '90',  10),
  requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '350', 10),

  tempMin:        parseFloat(process.env.TEMP_MIN       || '3'),
  tempMax:        parseFloat(process.env.TEMP_MAX       || '40'),
  offlineMinutes: parseInt(process.env.OFFLINE_MINUTES  || '15', 10),
  simDaysWarn:    parseInt(process.env.SIM_DAYS_WARN    || '7',  10),
  dailyReportHour:parseInt(process.env.DAILY_REPORT_HOUR || '8', 10),

  deviceTypes: (process.env.DEVICE_TYPES || 'shop,shop_liquid,shop_water')
    .split(',').map(s => s.trim()).filter(Boolean),
};

// Валидация обязательных параметров
if (!cfg.botToken) {
  console.error('❌ BOT_TOKEN не задан в .env');
  process.exit(1);
}
if (!['ru', 'pl'].includes(cfg.locale)) {
  console.warn(`⚠️  Неизвестная локаль "${cfg.locale}", используется "ru"`);
  cfg.locale = 'ru';
}

module.exports = cfg;