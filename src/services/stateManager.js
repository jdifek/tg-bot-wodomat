// src/services/stateManager.js
// Хранит состояние всех пользователей и аппаратов в памяти
// При перезапуске бота состояние сбрасывается (можно добавить SQLite позже)
'use strict';

const dayjs = require('dayjs');

// Map: telegramChatId -> UserState
const users = new Map();

function createUserState(chatId, appid, saler) {
  return {
    chatId,
    appid,
    saler,
    registeredAt: Date.now(),
    muteUntil: null,          // timestamp до которого заглушены уведомления

    // Кэш устройств: deviceId -> { location, lastSeen, ... }
    devices: new Map(),

    // Активные проблемы: ключ -> { type, deviceId, location, since, ... }
    activeAlerts: new Map(),

    // Накопленные алерты для отправки в следующем цикле
    pendingAlerts: [],

    // Уже отправленные QR платежи (pay_id) чтобы не дублировать
    sentQrPayments: new Set(),

    // Батчинг: текущий офсет для опроса 3.3.4
    batchOffset: 0,
    allDeviceIds: [],         // все ID устройств (обновляется раз в 10 мин)
    deviceIdsLastUpdate: 0,

    // Последний ежедневный отчёт (дата)
    lastDailyReportDate: null,
  };
}

function getUser(chatId) {
  return users.get(String(chatId)) || null;
}

function setUser(chatId, appid, saler) {
  const existing = users.get(String(chatId));
  if (existing) return existing; // уже есть
  const state = createUserState(String(chatId), appid, saler);
  users.set(String(chatId), state);
  return state;
}

function getAllUsers() {
  return Array.from(users.values());
}

function isMuted(userState) {
  if (!userState.muteUntil) return false;
  return Date.now() < userState.muteUntil;
}

function mute(userState, hours = 1) {
  userState.muteUntil = Date.now() + hours * 3600 * 1000;
}

function unmute(userState) {
  userState.muteUntil = null;
}

// ----------------------------------------------------------------
// Управление активными алертами
// ----------------------------------------------------------------

// Добавить/обновить алерт
function setAlert(userState, key, alertObj) {
  if (!userState.activeAlerts.has(key)) {
    userState.activeAlerts.set(key, { ...alertObj, since: Date.now() });
    userState.pendingAlerts.push(alertObj);
  }
}

// Убрать алерт (проблема решена) — добавить уведомление о восстановлении
function resolveAlert(userState, key, resolvedMsg) {
  if (userState.activeAlerts.has(key)) {
    userState.activeAlerts.delete(key);
    if (resolvedMsg) userState.pendingAlerts.push({ resolved: true, msg: resolvedMsg });
  }
}

// Забрать и очистить накопленные алерты
function flushPendingAlerts(userState) {
  const alerts = [...userState.pendingAlerts];
  userState.pendingAlerts = [];
  return alerts;
}

module.exports = {
  getUser,
  setUser,
  getAllUsers,
  isMuted,
  mute,
  unmute,
  setAlert,
  resolveAlert,
  flushPendingAlerts,
};
