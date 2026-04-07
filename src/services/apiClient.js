// src/services/apiClient.js — клиент к API Shengtiqi (生钛圈)
'use strict';

const axios  = require('axios');
const cfg    = require('../config');
const logger = require('../logger');

// Пауза между запросами
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Базовый запрос
async function apiGet(path, params = {}) {
  try {
    const url = `${cfg.apiBaseUrl}/${path}`;
    const resp = await axios.get(url, { params, timeout: 10000 });
    return resp.data;
  } catch (err) {
    logger.error(`API error [${path}]: ${err.message}`);
    return null;
  }
}

async function apiPost(path, params = {}) {
  try {
    const url = `${cfg.apiBaseUrl}/${path}`;
    const resp = await axios.post(url, null, { params, timeout: 10000 });
    return resp.data;
  } catch (err) {
    logger.error(`API error POST [${path}]: ${err.message}`);
    return null;
  }
}

// ----------------------------------------------------------------
// 1. Получить список всех устройств (постранично)
// ----------------------------------------------------------------
async function getAllDevices(appid, saler, type) {
  const devices = [];
  let page = 1;
  while (true) {
    const data = await apiGet('getdevicelist', { appid, saler, type, page });
    if (!data || data.code !== 0 || !Array.isArray(data.data) || data.data.length === 0) break;
    devices.push(...data.data);
    if (data.data.length < 20) break; // меньше 20 = последняя страница
    page++;
    await sleep(cfg.requestDelayMs);
  }
  return devices;
}

// ----------------------------------------------------------------
// 2. Детали одного устройства (3.3.4)
// ----------------------------------------------------------------
async function getDeviceDetail(appid, saler, deviceId) {
  return apiGet('device/getdetail', { appid, saler, deviceId });
}

// ----------------------------------------------------------------
// 3. Список аномальных устройств (3.3.18)
// ----------------------------------------------------------------
async function getExceptionDevices(appid, saler, type, page = 1, num = 100) {
  return apiGet('device/exception-status-query', { appid, saler, type, page, num });
}

// ----------------------------------------------------------------
// 4. Счётчик аномалий (3.3.17)
// ----------------------------------------------------------------
async function getExceptionCount(appid, saler, type) {
  return apiGet('device/exception-status-count', { appid, saler, type });
}

// ----------------------------------------------------------------
// 5. Записи потребления (3.2.3)
// ----------------------------------------------------------------
async function getConsumeList(appid, saler, beginTime, endTime, page = 1) {
  return apiGet('record/getlist', { appid, saler, beginTime, endTime, page });
}

// ----------------------------------------------------------------
// 6. Записи пополнений — QR (3.2.4)
// ----------------------------------------------------------------
async function getRechargeList(appid, saler, beginTime, endTime, page = 1) {
  return apiGet('addvalue/getlist', { appid, saler, beginTime, endTime, page });
}

// ----------------------------------------------------------------
// 7. SIM карты (3.4.1)
// ----------------------------------------------------------------
async function getSimList(appid, saler, page = 1) {
  return apiGet('simcard/getlist', { appid, saler, page });
}

async function getAllSims(appid, saler) {
  const sims = [];
  let page = 1;
  while (true) {
    const data = await getSimList(appid, saler, page);
    if (!data || data.code !== 0 || !Array.isArray(data.data) || data.data.length === 0) break;
    sims.push(...data.data);
    if (data.data.length < 20) break;
    page++;
    await sleep(cfg.requestDelayMs);
  }
  return sims;
}

// ----------------------------------------------------------------
// 8. Проверить авторизацию — пробуем получить список устройств
// ----------------------------------------------------------------
async function testAuth(appid, saler) {
  try {
    const data = await apiGet('getdevicelist', {
      appid, saler, type: 'shop', page: 1
    });
    // code 0 = успех, даже если data пустой
    return data !== null && (data.code === 0 || data.error === '0');
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------
// 9. Полный опрос всех аппаратов батчами с учётом лимита API
// ----------------------------------------------------------------
async function pollDevicesBatched(appid, saler, deviceIds, batchOffset, batchSize) {
  const slice = deviceIds.slice(batchOffset, batchOffset + batchSize);
  const results = [];
  for (const deviceId of slice) {
    const detail = await getDeviceDetail(appid, saler, deviceId);
    results.push({ deviceId, detail });
    await sleep(cfg.requestDelayMs);
  }
  return results;
}

module.exports = {
  getAllDevices,
  getDeviceDetail,
  getExceptionDevices,
  getExceptionCount,
  getConsumeList,
  getRechargeList,
  getAllSims,
  testAuth,
  pollDevicesBatched,
  sleep,
};
