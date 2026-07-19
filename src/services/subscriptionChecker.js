'use strict';

const cfg = require('../config');
const logger = require('../logger');

/**
 * Проверяет подписку пользователя через веб-бэкенд.
 * @returns {Promise<boolean>}
 */
async function checkSubscription(appid, saler) {
  try {
    const url = `${cfg.secondBackUrl}/api/bot/check-subscription?appid=${encodeURIComponent(appid)}&saler=${encodeURIComponent(saler)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data.active === true;
  } catch (err) {
    console.error(err);
    logger.error(err.stack || String(err));
    return false;
  }
}

module.exports = { checkSubscription };