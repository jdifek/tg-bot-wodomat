'use strict';

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

  invalidStartParam:
    `❌ Nieprawidłowy link startowy.\n\nProszę przejść przez link z panelu administracyjnego.\n\nPrzykład: \`t.me/NazwaBot?start=APPID_xxx_SALER_yyy\``,

  authFailed:
    `❌ Nie udało się połączyć z API.\n\nSprawdź poprawność danych w linku lub skontaktuj się z administratorem.`,

  subscriptionExpired:
    `❌ *Subskrypcja nieaktywna.*\n\nAby wznowić, skontaktuj się z administratorem.`,

  settingsSaved: `✅ Ustawienia zapisane.`,

  // ---- Komunikaty systemowe ----
  checkingApi:    `⏳ Sprawdzanie połączenia z API...`,
  checkingState:  `⏳ Sprawdzanie aktualnego stanu...`,
  fetchingData:   `⏳ Pobieranie danych...`,
  errorCheckingState: `❌ Błąd podczas sprawdzania stanu`,

  // ---- Etykiety ----
  accountLabel: `Konto`,
  updatedLabel: `Zaktualizowano`,
  sinceLabel:   `od`,

  // ---- Status urządzenia ----
  statusOnline:  `🟢 online`,
  statusOffline: `🔴 offline`,

  // ---- Polecenia ----
  cmdStatus: `📊 *Status monitorowania*`,
  cmdHelp:
    `📖 *Dostępne polecenia:*\n\n` +
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
  devicesHeader: `📟 *Lista automatów:*`,
  devicesEmpty:  `Nie znaleziono automatów.`,

  // ---- Alerty ----
  noProblems:      `✅ BRAK BŁĘDÓW`,
  currentProblems: (n) => `Aktualne problemy (${n}):`,

  // ---- Raport sprzedaży ----
  reportHeader: (date) => `📊 *Raport za ${date}*`,
  reportLine: (location, liters, amount) =>
    `📍 ${location}\n   💧 ${liters} l  |  💰 ${amount} zł`,
  reportTotal: (liters, amount) =>
    `━━━━━━━━━━━━━━\n📦 *Łącznie:* ${liters} l  |  💰 ${amount} zł`,
  reportEmpty: `Brak sprzedaży na dzisiaj.`,

  // ---- Mute ----
  mutedFor: (hours) => `🔕 Powiadomienia wyciszone na ${hours} h.`,
  unmuted: `🔔 Powiadomienia włączone.`,

  // ============================================================
  //  ALERTY — komunikaty o błędach
  // ============================================================

  alertHeader: (count) =>
    `🚨 *UWAGA! Wykryto problemy (${count})*\n` +
    `━━━━━━━━━━━━━━━━━━━━`,

  alertFooter: (time) => `\n🕐 Czas sprawdzenia: ${time}`,

  alertNoWater: (deviceId, location) =>
    `🚱 *BRAK WODY W ZBIORNIKU*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💡 Sprawdź zawór dopływu wody, działanie membran i pomp`,

  alertNoDispense: (deviceId, location, amount, time) =>
    `💸 *SPRZEDAŻ BEZ NALEWANIA*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💰 Kwota płatności: ${amount} zł\n` +
    (time ? `🕐 Czas transakcji: ${time}\n` : '') +
    `💡 Płatność zrealizowana, ale woda nie została wydana — sprawdź automat`,

  alertTempLow: (deviceId, location, temp, time) =>
    `🥶 *NISKA TEMPERATURA*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `🌡 Temperatura: *${temp}°C*\n` +
    (time ? `🕐 Od: ${time}\n` : '') +
    `💡 Sprawdź zasilanie i system ogrzewania automatu`,

  alertTempHigh: (deviceId, location, temp, time) =>
    `🔥 *WYSOKA TEMPERATURA*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `🌡 Temperatura: *${temp}°C*\n` +
    (time ? `🕐 Od: ${time}\n` : '') +
    `💡 Sprawdź system chłodzenia i wentylację`,

  alertOffline: (deviceId, location, minutes, lastConnect) =>
    `📵 *AUTOMAT BEZ POŁĄCZENIA*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `⏱ Brak połączenia: *${minutes} min.*\n` +
    (lastConnect ? `🕐 Ostatnie połączenie: ${lastConnect}\n` : '') +
    `💡 Sprawdź zasilanie lub działanie karty SIM`,

  dailyReportHeader: (date) =>
    `📊 *RAPORT SPRZEDAŻY ZA ${date}*\n━━━━━━━━━━━━━━━━━━━━`,

  dailyReportLine: (location, liters, amount) =>
    `📍 *${location}*\n   💧 ${liters} l  💰 ${amount} zł`,

  dailyReportTotal: (liters, amount) =>
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *ŁĄCZNIE:* ${liters} l  |  💰 *${amount} zł*`,

  dailyReportEmpty: `📊 *Raport za wczoraj:* brak zarejestrowanej sprzedaży.`,

  alertStatusOnline: (deviceId, location) =>
    `🟢 *AUTOMAT ZNOWU ONLINE*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\``,

  alertStatusOfflineShort: (deviceId, location) =>
    `🔴 *AUTOMAT OFFLINE*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💡 Możliwe problemy z automatem`,

  alertQrPayment: (deviceId, location, amount, time) =>
    `💳 *ZDALNE DOŁADOWANIE QR*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💰 Kwota: *${amount} zł*\n` +
    (time ? `🕐 Czas: ${time}\n` : ''),

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

  alertWaterLevel: (deviceId, location, level, lastConnect) => {
    const STATUS_MAP = {
      '异常': 'Nieprawidłowy', '正常': 'Normalny',
      '空': 'Pusty', '空仓': 'Pusty',
      '缺水': 'Brak wody', '无水': 'Brak wody',
      '低水位': 'Niski poziom', '高水位': 'Wysoki poziom',
    };
    const levelPL = STATUS_MAP[level] || level;
    return `🚱 *PROBLEM Z POZIOMEM WODY*\n` +
      `📍 ${location}\n` +
      `🔧 ID: \`${deviceId}\`\n` +
      `📊 Status: ${levelPL}\n` +
      (lastConnect ? `🕐 Od: ${lastConnect}\n` : '') +
      `💡 Sprawdź zawór dopływu wody, działanie membran i pomp`;
  },

  alertWaterPressure: (deviceId, location, pressure, lastConnect) => {
    const STATUS_MAP = {
      '异常': 'Nieprawidłowy', '正常': 'Normalny',
      '空': 'Pusty', '空仓': 'Pusty',
      '缺水': 'Brak wody', '无水': 'Brak wody',
      '低压力': 'Niskie ciśnienie', '高压力': 'Wysokie ciśnienie', '无压力': 'Brak ciśnienia',
    };
    const pressurePL = STATUS_MAP[pressure] || pressure;
    return `💨 *PROBLEM Z CIŚNIENIEM WODY*\n` +
      `📍 ${location}\n` +
      `🔧 ID: \`${deviceId}\`\n` +
      `📊 Status ciśnienia: ${pressurePL}\n` +
      (lastConnect ? `🕐 Od: ${lastConnect}\n` : '') +
      `💡 Sprawdź podłączenie wodociągu`;
  },

  alertResolved: (deviceId, location, type) =>
    `✅ *PROBLEM ROZWIĄZANY*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `🔧 Typ: ${type}`,
};