// src/services/sender.js
// Отправка алертов в Telegram
'use strict';

const dayjs  = require('dayjs');
const logger = require('../logger');
const state  = require('./stateManager');
const t      = require('../locales/' + require('../config').locale);

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

    // Разбиваем на: отчёты (отдельно), алерты (вместе)
    const reports     = alerts.filter(a => a.isReport);
    const realAlerts  = alerts.filter(a => !a.isReport);

    // Отправляем обычные алерты одним сообщением (или несколькими если много)
    if (realAlerts.length > 0) {
      await sendAlertsBatch(bot, userState.chatId, realAlerts);
    }

    // Отправляем отчёты отдельно
    for (const rep of reports) {
      await safeSend(bot, userState.chatId, rep.msg);
      await sleep(300);
    }
  }
}

// ================================================================
// Алерты группируем и отправляем батчами по 10 (лимит Telegram)
// ================================================================
async function sendAlertsBatch(bot, chatId, alerts) {
  const CHUNK = 10;
  for (let i = 0; i < alerts.length; i += CHUNK) {
    const chunk = alerts.slice(i, i + CHUNK);
    const time  = dayjs().format('DD.MM.YYYY HH:mm');
    const lines = [t.alertHeader(alerts.length)];
    lines.push(...chunk.map(a => a.msg));
    lines.push(t.alertFooter(time));
    await safeSend(bot, chatId, lines.join('\n\n'));
    await sleep(300);
  }
}

// ================================================================
// Безопасная отправка с обработкой ошибок
// ================================================================
async function safeSend(bot, chatId, text) {
  try {
    // Telegram ограничение: сообщение до 4096 символов
    if (text.length > 4000) {
      const parts = splitText(text, 4000);
      for (const part of parts) {
        await bot.telegram.sendMessage(chatId, part, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        });
        await sleep(100);
      }
    } else {
      await bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });
    }
  } catch (err) {
    logger.error(`Send message to ${chatId} failed: ${err.message}`);
  }
}

function splitText(text, maxLen) {
  const parts = [];
  while (text.length > maxLen) {
    let cut = text.lastIndexOf('\n', maxLen);
    if (cut === -1) cut = maxLen;
    parts.push(text.slice(0, cut));
    text = text.slice(cut).trimStart();
  }
  if (text) parts.push(text);
  return parts;
}

module.exports = { flushAllAlerts, safeSend };
