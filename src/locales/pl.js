// src/locales/pl.js — Język polski

module.exports = {
  // ---- Powitanie ----
  welcome: (saler) =>
    `👋 *Witamy w systemie monitorowania wodomatów!*\n\n` +
    `🏪 Konto: \`${saler}\`\n\n` +
    `Bot będzie wysyłał Ci powiadomienia o problemach z automatami co 5 minut.\n\n` +
    `Użyj poniższych poleceń do zarządzania:`,

  alreadyRegistered: (saler) =>
    `✅ Jesteś już połączony.\nKonto: \`${saler}\`\nMonitorowanie aktywne.`,

  invalidStart:
    `❌ Nieprawidłowy link uruchomienia.\n\nProszę przejść przez link z panelu administracyjnego.\n\nPrzykład: \`t.me/NazwaBot?start=APPID_xxx_SALER_yyy\``,

  authFailed:
    `❌ Nie udało się połączyć z API.\n\nSprawdź poprawność danych w linku lub skontaktuj się z administratorem.`,

  settingsSaved: `✅ Ustawienia zapisane.`,

  // ---- Polecenia ----
  cmdStatus: `📊 *Status monitorowania*`,
  cmdHelp:
    `📖 *Dostępne polecenia:*\n\n` +
    `/status — status monitorowania i lista automatów\n` +
    `/devices — lista wszystkich automatów\n` +
    `/report — raport sprzedaży za dzisiaj\n` +
    `/alerts — pokaż aktywne problemy\n` +
    `/mute — wyłącz powiadomienia na 1 godzinę\n` +
    `/unmute — włącz powiadomienia\n` +
    `/help — ta pomoc`,

  cmdUnknown: `❓ Nieznane polecenie. Wpisz /help, aby uzyskać pomoc.`,

  // ---- Status ----
  monitoringActive: `✅ Monitorowanie aktywne`,
  monitoringMuted: (until) => `🔕 Powiadomienia wyłączone do ${until}`,
  totalDevices: (n) => `📟 Urządzeń łącznie: *${n}*`,
  devicesOnline: (n) => `🟢 Online: *${n}*`,
  devicesOffline: (n) => `🔴 Offline: *${n}*`,
  activeAlerts: (n) => `⚠️ Aktywnych problemów: *${n}*`,
  noAlerts: `✅ Brak aktywnych problemów`,

  // ---- Lista urządzeń ----
  devicesHeader: `📟 *Lista automatów:*\n`,
  deviceLine: (id, location, status) =>
    `${status === 'online' ? '🟢' : '🔴'} \`${id}\` — ${location}`,
  devicesEmpty: `Nie znaleziono automatów.`,

  // ---- Raport sprzedaży ----
  reportHeader: (date) => `📊 *Raport sprzedaży za ${date}*\n`,
  reportLine: (location, liters, amount) =>
    `📍 ${location}\n   💧 ${liters} l  |  💰 ${amount} zł`,
  reportTotal: (liters, amount) =>
    `\n━━━━━━━━━━━━━━\n` +
    `📦 *Łącznie:* ${liters} l  |  💰 ${amount} zł`,
  reportEmpty: `Brak sprzedaży na dzisiaj.`,

  // ---- Mute ----
  mutedFor: (hours) => `🔕 Powiadomienia wyłączone na ${hours} h.`,
  unmuted: `🔔 Powiadomienia włączone.`,

  // ============================================================
  //  ALERTY — komunikaty o błędach
  // ============================================================

  alertHeader: (count) =>
    `🚨 *UWAGA! Wykryto problemy (${count})*\n` +
    `━━━━━━━━━━━━━━━━━━━━`,

  alertFooter: (time) => `\n🕐 Czas sprawdzenia: ${time}`,

  // 1. Brak wody / zbiornik się napełnia
  alertNoWater: (deviceId, location) =>
    `🚱 *BRAK WODY W ZBIORNIKU*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💡 Sprawdź zawór dopływu wody, działanie membran i pomp`,

  // 2. Sprzedaż bez nalewania
  alertNoDispense: (deviceId, location, amount) =>
    `💸 *SPRZEDAŻ BEZ NALEWANIA*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💰 Kwota płatności: ${amount} zł\n` +
    `💡 Płatność zrealizowana, ale woda nie została wydana — sprawdź automat`,

  // 3a. Niska temperatura
  alertTempLow: (deviceId, location, temp) =>
    `🥶 *NISKA TEMPERATURA*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `🌡 Temperatura: *${temp}°C*\n` +
    `💡 Sprawdź zasilanie i system ogrzewania automatu`,

  // 3b. Wysoka temperatura
  alertTempHigh: (deviceId, location, temp) =>
    `🔥 *WYSOKA TEMPERATURA*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `🌡 Temperatura: *${temp}°C*\n` +
    `💡 Sprawdź system chłodzenia i wentylację`,

  // 4. Offline ponad 15 minut
  alertOffline: (deviceId, location, minutes) =>
    `📵 *AUTOMAT BEZ POŁĄCZENIA*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `⏱ Brak połączenia: *${minutes} min.*\n` +
    `💡 Sprawdź zasilanie lub działanie karty SIM`,

  // 5. Dzienny raport sprzedaży
  dailyReportHeader: (date) =>
    `📊 *RAPORT SPRZEDAŻY ZA ${date}*\n━━━━━━━━━━━━━━━━━━━━`,

  dailyReportLine: (location, liters, amount) =>
    `📍 *${location}*\n   💧 ${liters} l  💰 ${amount} zł`,

  dailyReportTotal: (liters, amount) =>
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *ŁĄCZNIE:* ${liters} l  |  💰 *${amount} zł*`,

  dailyReportEmpty: `📊 *Raport za wczoraj:* brak zarejestrowanej sprzedaży.`,

  // 6. Status online/offline
  alertStatusOnline: (deviceId, location) =>
    `🟢 *AUTOMAT ZNOWU ONLINE*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\``,

  alertStatusOfflineShort: (deviceId, location) =>
    `🔴 *AUTOMAT OFFLINE*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💡 Możliwe problemy z automatem`,

  // 7. Doładowanie QR
  alertQrPayment: (deviceId, location, amount) =>
    `💳 *ZDALNE DOŁADOWANIE QR*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💰 Kwota: *${amount} zł*`,

  // 8. Wygasa opłata za monitoring (SIM)
  alertSimExpiring: (iccid, deviceLocation, daysLeft, expireDate) =>
    `📶 *WYGASA OPŁATA ZA KARTĘ SIM*\n` +
    `📍 ${deviceLocation}\n` +
    `🔢 ICCID: \`${iccid}\`\n` +
    `📅 Wygasa: *${expireDate}*\n` +
    `⏳ Pozostało dni: *${daysLeft}*\n` +
    `💡 Dokonaj opłaty za monitoring`,

  alertSimExpired: (iccid, deviceLocation) =>
    `🚫 *KARTA SIM WYGASŁA — DOKONAJ OPŁATY*\n` +
    `📍 ${deviceLocation}\n` +
    `🔢 ICCID: \`${iccid}\`\n` +
    `💡 Dokonaj opłaty za monitoring natychmiast`,

 // В pl.js — единый маппинг для уровня воды и давления
alertWaterPressure: (deviceId, location, pressure) => {
  const STATUS_MAP = { '异常': 'Nieprawidłowy', '正常': 'Normalny' };
  const pressurePL = STATUS_MAP[pressure] || pressure;
  return `💨 *PROBLEM Z CIŚNIENIEM WODY*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `📊 Status ciśnienia: ${pressurePL}\n` +
    `💡 Sprawdź podłączenie wodociągu`;
},

alertWaterLevel: (deviceId, location, level) => {
  const STATUS_MAP = { '异常': 'Nieprawidłowy', '正常': 'Normalny' };
  const levelPL = STATUS_MAP[level] || level;
  return `🚱 *PROBLEM Z POZIOMEM WODY*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `📊 Status: ${levelPL}\n` +
    `💡 Sprawdź zawór dopływu wody, działanie membran i pomp`;
},

  // Problem rozwiązany
  alertResolved: (deviceId, location, type) =>
    `✅ *PROBLEM ROZWIĄZANY*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `🔧 Typ: ${type}`,
};
