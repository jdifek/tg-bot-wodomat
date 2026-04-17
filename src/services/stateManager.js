// src/services/stateManager.js
// Хранит состояние всех пользователей и аппаратов в памяти
'use strict';

const dayjs = require('dayjs');

// Map: telegramChatId -> UserState
const users = new Map();

function createUserState(chatId, appid, saler) {
  return {
    chatId: String(chatId),
    appid,
    saler,
    registeredAt: Date.now(),
    muteUntil: null,

    // Кэш устройств
    devices: new Map(),

    // Активные проблемы
    activeAlerts: new Map(),

    // Накопленные алерты для отправки
    pendingAlerts: [],

    // Уже отправленные QR платежи
    sentQrPayments: new Set(),

    // Батчинг устройств
    batchOffset: 0,
    allDeviceIds: [],
    deviceIdsLastUpdate: 0,

    // Ежедневный отчёт
    lastDailyReportDate: null,
  };
}

function getUser(chatId) {
  return users.get(String(chatId)) || null;
}

function setUser(chatId, appid, saler) {
  chatId = String(chatId);
  if (users.has(chatId)) return users.get(chatId);

  const state = createUserState(chatId, appid, saler);
  users.set(chatId, state);
  return state;
}

function getAllUsers() {
  return Array.from(users.values());
}

/** Возвращает всех пользователей с данным saler (главное исправление) */
function getUsersBySaler(saler) {
  return getAllUsers().filter(u => u.saler === saler);
}

function isMuted(userState) {
  if (!userState?.muteUntil) return false;
  return Date.now() < userState.muteUntil;
}

function mute(userState, hours = 1) {
  if (userState) userState.muteUntil = Date.now() + hours * 3600 * 1000;
}

function unmute(userState) {
  if (userState) userState.muteUntil = null;
}

// ================================================================
// Работа с алертами для всех пользователей одного saler
// ================================================================

/** Добавить алерт ВСЕМ пользователям с этим saler */
function addAlertToAll(saler, key, alertObj) {
  const usersWithSaler = getUsersBySaler(saler);
  for (const userState of usersWithSaler) {
    if (!userState.activeAlerts.has(key)) {
      userState.activeAlerts.set(key, { ...alertObj, since: Date.now() });
      userState.pendingAlerts.push({ ...alertObj });
    }
  }
}

/** Снять алерт у всех пользователей с этим saler */
function resolveAlertForAll(saler, key, resolvedMsg) {
  const usersWithSaler = getUsersBySaler(saler);
  for (const userState of usersWithSaler) {
    if (userState.activeAlerts.has(key)) {
      userState.activeAlerts.delete(key);
      if (resolvedMsg) {
        userState.pendingAlerts.push({ resolved: true, msg: resolvedMsg });
      }
    }
  }
}

/** Добавить обычный pending alert всем пользователям с этим saler */
function addPendingAlertToAll(saler, alertObj) {
  const usersWithSaler = getUsersBySaler(saler);
  for (const userState of usersWithSaler) {
    userState.pendingAlerts.push({ ...alertObj });
  }
}

/** Забрать и очистить накопленные алерты для конкретного пользователя */
function flushPendingAlerts(userState) {
  if (!userState) return [];
  const alerts = [...userState.pendingAlerts];
  userState.pendingAlerts = [];
  return alerts;
}

module.exports = {
  getUser,
  setUser,
  getAllUsers,
  getUsersBySaler,
  isMuted,
  mute,
  unmute,
  addAlertToAll,
  resolveAlertForAll,
  addPendingAlertToAll,
  flushPendingAlerts,
};