// src/services/sender.js
// Отправка алертов в Telegram
'use strict';

const dayjs = require('dayjs');
const logger = require('../logger');
const state = require('./stateManager');
const t = require('../locales/' + require('../config').locale);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ================================================================
// Wysyłanie zgromadzonych alertów do wszystkich użytkowników
// ================================================================
async function flushAllAlerts(bot) {
  const users = state.getAllUsers();

  for (const userState of users) {
    if (state.isMuted(userState)) continue;

    const alerts = state.flushPendingAlerts(userState);
    if (alerts.length === 0) continue;

    // Rozdzielamy raporty i zwykłe alerty
    const reports = alerts.filter(a => a.isReport);
    const realAlerts = alerts.filter(a => !a.isReport);

    // Zwykłe alerty grupujemy i wysyłamy w batchach
    if (realAlerts.length > 0) {
      await sendAlertsBatch(bot, userState.chatId, realAlerts);
    }

    // Raporty wysyłamy pojedynczo (zwykle są ważne i obszerne)
    for (const rep of reports) {
      await safeSend(bot, userState.chatId, rep.msg);
      await sleep(300); // niewielkie opóźnienie między raportami
    }
  }
}

// ================================================================
// Grupowanie alertów i wysyłanie w batchach (po 10 sztuk)
// ================================================================
async function sendAlertsBatch(bot, chatId, alerts) {
  const CHUNK_SIZE = 10;

  for (let i = 0; i < alerts.length; i += CHUNK_SIZE) {
    const chunk = alerts.slice(i, i + CHUNK_SIZE);

    const time = dayjs().format('DD.MM.YYYY HH:mm');

    const lines = [
      t.alertHeader(alerts.length),           // całkowita liczba wszystkich alertów, nie tylko w batchu
      ...chunk.map(a => a.msg),
      t.alertFooter(time)
    ];

    await safeSend(bot, chatId, lines.join('\n\n'));
    await sleep(300);
  }
}

// ================================================================
// Bezpieczne wysyłanie z obsługą limitów Telegram
// ================================================================
async function safeSend(bot, chatId, text) {
  const telegram = bot?.telegram ?? bot;

  if (!telegram?.sendMessage) {
    logger.error(`safeSend: invalid bot object for chatId=${chatId}`);
    return;
  }

  const send = async (txt, mode) => {
    await telegram.sendMessage(chatId, txt, {
      parse_mode: mode,
      disable_web_page_preview: true,
    });
  };

  try {
    if (text.length > 4000) {
      for (const part of splitText(text, 4000)) {
        try {
          await send(part, 'Markdown');
        } catch (e) {
          if (e.code === 400) {
            logger.warn(`Markdown parse error for ${chatId}, retrying as plain text`);
            await send(part, undefined);
          } else throw e;
        }
        await sleep(150);
      }
    } else {
      try {
        await send(text, 'Markdown');
      } catch (e) {
        if (e.code === 400) {
          logger.warn(`Markdown parse error for ${chatId}, retrying as plain text`);
          await send(text, undefined);
        } else throw e;
      }
    }
  } catch (err) {
    logger.error(`Failed to send message to ${chatId}: ${err.message}`);
    if (err.code === 429) logger.warn(`Rate limit hit for chat ${chatId}`);
  }
}

// ================================================================
// Dzielenie długiego tekstu na części
// ================================================================
function splitText(text, maxLen) {
  const parts = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let cutIndex = remaining.lastIndexOf('\n', maxLen);

    // Jeśli nie znaleziono przeniesienia — ciniemy po znakach
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