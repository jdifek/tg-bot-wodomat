// src/services/sender.js
// Отправка алертов в Telegram
'use strict';

const dayjs = require('dayjs');
const logger = require('../logger');
const state = require('./stateManager');
const t = require('../locales/' + require('../config').locale);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ================================================================
// Отправка накопленных алертов всем пользователям
// ================================================================
async function flushAllAlerts(bot) {
  const users = state.getAllUsers();

  for (const userState of users) {
    if (state.isMuted(userState)) continue;

    const alerts = state.flushPendingAlerts(userState);
    if (alerts.length === 0) continue;

    // Разделяем отчёты и обычные алерты
    const reports = alerts.filter(a => a.isReport);
    const realAlerts = alerts.filter(a => !a.isReport);

    // Обычные алерты группируем и отправляем батчами
    if (realAlerts.length > 0) {
      await sendAlertsBatch(bot, userState.chatId, realAlerts);
    }

    // Отчёты отправляем по одному (обычно они важные и объёмные)
    for (const rep of reports) {
      await safeSend(bot, userState.chatId, rep.msg);
      await sleep(300); // небольшая задержка между отчётами
    }
  }
}

// ================================================================
// Группировка алертов и отправка батчами (по 10 штук)
// ================================================================
async function sendAlertsBatch(bot, chatId, alerts) {
  const CHUNK_SIZE = 10;

  for (let i = 0; i < alerts.length; i += CHUNK_SIZE) {
    const chunk = alerts.slice(i, i + CHUNK_SIZE);

    const time = dayjs().format('DD.MM.YYYY HH:mm');

    const lines = [
      t.alertHeader(alerts.length),           // общее количество всех алертов, а не только в чанке
      ...chunk.map(a => a.msg),
      t.alertFooter(time)
    ];

    await safeSend(bot, chatId, lines.join('\n\n'));
    await sleep(300);
  }
}

// ================================================================
// Безопасная отправка с обработкой лимитов Telegram
// ================================================================
async function safeSend(bot, chatId, text) {
  if (!text || typeof text !== 'string') return;

  try {
    // Telegram лимит — 4096 символов
    if (text.length > 4000) {
      const parts = splitText(text, 4000);

      for (const part of parts) {
        await bot.telegram.sendMessage(chatId, part, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        });
        await sleep(150); // чуть больше задержки при разбиении длинных сообщений
      }
    } else {
      await bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });
    }
  } catch (err) {
    logger.error(`Failed to send message to ${chatId}: ${err.message}`);
    
    // Дополнительно можно логировать chatId и длину текста при частых ошибках
    if (err.code === 429) {
      logger.warn(`Rate limit hit for chat ${chatId}`);
    }
  }
}

// ================================================================
// Разбиение длинного текста на части
// ================================================================
function splitText(text, maxLen) {
  const parts = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let cutIndex = remaining.lastIndexOf('\n', maxLen);

    // Если не нашли перенос — режем посимвольно
    if (cutIndex === -1) cutIndex = maxLen;

    parts.push(remaining.slice(0, cutIndex));
    remaining = remaining.slice(cutIndex).trimStart();
  }

  if (remaining) parts.push(remaining);

  return parts;
}

module.exports = {
  flushAllAlerts,
  safeSend,
};