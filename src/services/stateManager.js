// src/services/stateManager.js
'use strict';

const dayjs = require('dayjs');
const fs = require('fs');
const USERS_FILE = './data/users.json';

// Map: telegramChatId -> UserState
const users = new Map();

// ── Per-saler глобальное состояние (не дублируется между chatId) ──
const dailyReportSentByDate  = new Map(); // saler -> date
const weeklyReportSentByDate  = new Map(); // saler -> 'YYYY-[W]WW'
const monthlyReportSentByDate = new Map(); // saler -> 'YYYY-MM'

const sentQrPaymentsBySaler  = new Map(); // saler -> Set<string>
const lastQrCheckBySaler     = new Map(); // saler -> timestamp
const lastExceptionCheckBySaler = new Map(); // saler -> timestamp
const lastSimCheckBySaler    = new Map(); // saler -> timestamp

// ================================================================
// UserState factory
// ================================================================
function createUserState(chatId, appid, saler) {
  return {
    chatId: String(chatId),
    appid,
    saler,
    registeredAt: Date.now(),
    muteUntil: null,

    // Cache urządzeń — per user (каждый видит свои устройства)
    devices: new Map(),

    // Aktywne problemy — per user
    activeAlerts: new Map(),

    // Zgromadzone alerty do wysłania — per user
    pendingAlerts: [],

    // Batchowanie urządzeń
    batchOffset: 0,
    allDeviceIds: [],
    deviceIdsLastUpdate: 0,

    // Raport dzienny
    lastDailyReportDate: null,
  };
  // УДАЛЕНО: sentQrPayments, _lastQrCheck, _lastExceptionCheck, _lastSimCheck
  // Они теперь хранятся per-saler в Map'ах выше
}

// ================================================================
// CRUD пользователей
// ================================================================
function getUser(chatId) {
  return users.get(String(chatId)) || null;
}

function setUser(chatId, appid, saler) {
  chatId = String(chatId);
  if (users.has(chatId)) return users.get(chatId);
  const state = createUserState(chatId, appid, saler);
  users.set(chatId, state);
  saveUsers();
  return state;
}

function getAllUsers() {
  return Array.from(users.values());
}

function getUsersBySaler(saler) {
  return getAllUsers().filter(u => u.saler === saler);
}

// ================================================================
// Mute
// ================================================================
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
// Per-saler: QR-платежи (дедупликация)
// ================================================================
function getSentQrPayments(saler) {
  if (!sentQrPaymentsBySaler.has(saler)) {
    sentQrPaymentsBySaler.set(saler, new Set());
  }
  return sentQrPaymentsBySaler.get(saler);
}

function getLastQrCheck(saler) {
  return lastQrCheckBySaler.get(saler) || 0;
}

function setLastQrCheck(saler, time) {
  lastQrCheckBySaler.set(saler, time);
}

// ================================================================
// Per-saler: таймеры проверок
// ================================================================
function getLastExceptionCheck(saler) {
  return lastExceptionCheckBySaler.get(saler) || 0;
}

function setLastExceptionCheck(saler, time) {
  lastExceptionCheckBySaler.set(saler, time);
}

function getLastSimCheck(saler) {
  return lastSimCheckBySaler.get(saler) || 0;
}

function setLastSimCheck(saler, time) {
  lastSimCheckBySaler.set(saler, time);
}

// ================================================================
// Алерты — рассылка всем chatId одного saler
// ================================================================

/** Добавить активный алерт всем пользователям saler */
function addAlertToAll(saler, key, alertObj) {
  for (const userState of getUsersBySaler(saler)) {
    if (!userState.activeAlerts.has(key)) {
      userState.activeAlerts.set(key, { ...alertObj, since: Date.now() });
      userState.pendingAlerts.push({ ...alertObj });
    }
  }
}

/** Снять алерт у всех пользователей saler */
function resolveAlertForAll(saler, key, resolvedMsg) {
  for (const userState of getUsersBySaler(saler)) {
    if (userState.activeAlerts.has(key)) {
      userState.activeAlerts.delete(key);
      if (resolvedMsg) {
        userState.pendingAlerts.push({ resolved: true, msg: resolvedMsg });
      }
    }
  }
}

/** Добавить pending-алерт (уведомление без состояния) всем пользователям saler */
function addPendingAlertToAll(saler, alertObj) {
  for (const userState of getUsersBySaler(saler)) {
    userState.pendingAlerts.push({ ...alertObj });
  }
}

/** Забрать и очистить очередь алертов для конкретного пользователя */
function flushPendingAlerts(userState) {
  if (!userState) return [];
  const alerts = [...userState.pendingAlerts];
  userState.pendingAlerts = [];
  return alerts;
}

// ================================================================
// Ежедневный / еженедельный / ежемесячный отчёт
// ================================================================
function getDailyReportSent(saler)       { return dailyReportSentByDate.get(saler)  || null; }
function setDailyReportSent(saler, date) { dailyReportSentByDate.set(saler, date); }

function getWeeklyReportSent(saler)      { return weeklyReportSentByDate.get(saler) || null; }
function setWeeklyReportSent(saler, key) { weeklyReportSentByDate.set(saler, key); }

function getMonthlyReportSent(saler)     { return monthlyReportSentByDate.get(saler) || null; }
function setMonthlyReportSent(saler, key){ monthlyReportSentByDate.set(saler, key); }

// ================================================================
// Персистентность пользователей
// ================================================================
function saveUsers() {
  const data = getAllUsers().map(u => ({
    chatId: u.chatId,
    appid:  u.appid,
    saler:  u.saler,
  }));
  fs.mkdirSync('./data', { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(data));
}

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    for (const u of data) {
      users.set(u.chatId, createUserState(u.chatId, u.appid, u.saler));
    }
    console.log(`Loaded ${data.length} users from file`);
  } catch (e) {
    console.error('Failed to load users:', e.message);
  }
}

loadUsers();

module.exports = {
  // пользователи
  getUser,
  setUser,
  getAllUsers,
  getUsersBySaler,

  // mute
  isMuted,
  mute,
  unmute,

  // алерты
  addAlertToAll,
  resolveAlertForAll,
  addPendingAlertToAll,
  flushPendingAlerts,

  // отчёты
  getDailyReportSent,
  setDailyReportSent,
  getWeeklyReportSent,
  setWeeklyReportSent,
  getMonthlyReportSent,
  setMonthlyReportSent,

  // per-saler дедупликация QR
  getSentQrPayments,
  getLastQrCheck,
  setLastQrCheck,

  // per-saler таймеры
  getLastExceptionCheck,
  setLastExceptionCheck,
  getLastSimCheck,
  setLastSimCheck,
};