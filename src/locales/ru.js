'use strict';

module.exports = {
  // ---- Приветствие ----
  welcome: (saler) =>
    `👋 *Добро пожаловать в систему мониторинга водоматов!*\n\n` +
    `🏪 Аккаунт: \`${saler}\`\n\n` +
    `Бот будет отправлять вам уведомления о проблемах с аппаратами каждые 5 минут.\n\n` +
    `Используйте команды ниже для управления:`,

  alreadyRegistered: (saler) =>
    `✅ Вы уже подключены.\nАккаунт: \`${saler}\`\nМониторинг активен.`,

  invalidStart:
    `❌ Неверная ссылка запуска.\n\nПожалуйста, перейдите по ссылке из вашей админ-панели.\n\nПример: \`t.me/БотИмя?start=APPID_xxx_SALER_yyy\``,

  invalidStartParam:
    `❌ Неверная ссылка запуска.\n\nПожалуйста, перейдите по ссылке из вашей админ-панели.\n\nПример: \`t.me/БотИмя?start=APPID_xxx_SALER_yyy\``,

  authFailed:
    `❌ Не удалось подключиться к API.\n\nПроверьте правильность данных в ссылке или обратитесь к администратору.`,

  subscriptionExpired:
    `❌ *Подписка неактивна.*\n\nДля возобновления обратитесь к администратору.`,

  settingsSaved: `✅ Настройки сохранены.`,

  // ---- Системные сообщения ----
  checkingApi:    `⏳ Проверка подключения к API...`,
  checkingState:  `⏳ Проверка текущего состояния...`,
  fetchingData:   `⏳ Загрузка данных...`,
  errorCheckingState: `❌ Ошибка при проверке состояния`,

  // ---- Лейблы ----
  accountLabel: `Аккаунт`,
  updatedLabel: `Обновлено`,
  sinceLabel:   `с`,

  // ---- Статус устройства ----
  statusOnline:  `🟢 онлайн`,
  statusOffline: `🔴 оффлайн`,

  // ---- Команды ----
  cmdStatus: `📊 *Статус мониторинга*`,
  cmdHelp:
    `📖 *Доступные команды:*\n\n` +
    `/devices — список всех аппаратов\n` +
    `/report — отчёт продаж за сегодня\n` +
    `/alerts — показать текущие активные проблемы\n` +
    `/mute — отключить уведомления на 1 час\n` +
    `/unmute — включить уведомления\n` +
    `/help — эта справка`,

  cmdUnknown: `❓ Неизвестная команда. Введите /help для справки.`,

  // ---- Статус ----
  monitoringActive: `✅ Мониторинг активен`,
  monitoringMuted: (until) => `🔕 Уведомления отключены до ${until}`,
  totalDevices: (n) => `📟 Устройств всего: *${n}*`,
  devicesOnline: (n) => `🟢 Онлайн: *${n}*`,
  devicesOffline: (n) => `🔴 Оффлайн: *${n}*`,
  activeAlerts: (n) => `⚠️ Активных проблем: *${n}*`,
  noAlerts: `✅ Активных проблем нет`,

  // ---- Список устройств ----
  devicesHeader: `📟 *Список аппаратов:*`,
  devicesEmpty:  `Аппараты не найдены.`,

  // ---- Алерты ----
  noProblems:       `✅ ОШИБОК НЕТ`,
  currentProblems:  (n) => `Текущие проблемы (${n}):`,

  // ---- Отчёт продаж ----
  reportHeader: (date) => `📊 *Отчёт продаж за ${date}*`,
  reportLine: (location, liters, amount) =>
    `📍 ${location}\n   💧 ${liters} л  |  💰 ${amount} zł`,
  reportTotal: (liters, amount) =>
    `━━━━━━━━━━━━━━\n📦 *Итого:* ${liters} л  |  💰 ${amount} zł`,
  reportEmpty: `За сегодня продаж не найдено.`,

  // ---- Mute ----
  mutedFor: (hours) => `🔕 Уведомления отключены на ${hours} ч.`,
  unmuted: `🔔 Уведомления включены.`,

  // ============================================================
  //  АЛЕРТЫ — сообщения об ошибках
  // ============================================================

  alertHeader: (count) =>
    `🚨 *ВНИМАНИЕ! Обнаружены проблемы (${count})*\n` +
    `━━━━━━━━━━━━━━━━━━━━`,

  alertFooter: (time) => `\n🕐 Время проверки: ${time}`,

  alertNoWater: (deviceId, location) =>
    `🚱 *НЕТ ВОДЫ В БАКЕ*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💡 Проверьте кран подачи воды, работу мембран и насосов`,

  alertNoDispense: (deviceId, location, amount) =>
    `💸 *ПРОДАЖА БЕЗ РОЗЛИВА*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💰 Сумма оплаты: ${amount} zł\n` +
    `💡 Проведена оплата, но вода не выдана — проверьте аппарат`,

  alertTempLow: (deviceId, location, temp) =>
    `🥶 *НИЗКАЯ ТЕМПЕРАТУРА*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `🌡 Температура: *${temp}°C*\n` +
    `💡 Проверьте электричество и систему обогрева водомата`,

  alertTempHigh: (deviceId, location, temp) =>
    `🔥 *ВЫСОКАЯ ТЕМПЕРАТУРА*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `🌡 Температура: *${temp}°C*\n` +
    `💡 Проверьте систему охлаждения и вентиляцию`,

  alertOffline: (deviceId, location, minutes) =>
    `📵 *АППАРАТ НЕ НА СВЯЗИ*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `⏱ Не выходил на связь: *${minutes} мин.*\n` +
    `💡 Проверьте подачу электричества или работу SIM-карты`,

  dailyReportHeader: (date) =>
    `📊 *ОТЧЁТ ПРОДАЖ ЗА ${date}*\n━━━━━━━━━━━━━━━━━━━━`,

  dailyReportLine: (location, liters, amount) =>
    `📍 *${location}*\n   💧 ${liters} л  💰 ${amount} zł`,

  dailyReportTotal: (liters, amount) =>
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *ИТОГО:* ${liters} л  |  💰 *${amount} zł*`,

  dailyReportEmpty: `📊 *Отчёт за вчера:* продаж не зафиксировано.`,

  alertStatusOnline: (deviceId, location) =>
    `🟢 *АППАРАТ СНОВА ОНЛАЙН*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\``,

  alertStatusOfflineShort: (deviceId, location) =>
    `🔴 *АППАРАТ ОФФЛАЙН*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💡 Возможно есть проблемы с аппаратом`,

  alertQrPayment: (deviceId, location, amount) =>
    `💳 *УДАЛЁННОЕ ПОПОЛНЕНИЕ QR*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💰 Сумма: *${amount} zł*`,

  alertSimExpiring: (iccid, deviceLocation, daysLeft, expireDate) =>
    `📶 *ИСТЕКАЕТ ОПЛАТА SIM-КАРТЫ*\n` +
    `📍 ${deviceLocation}\n` +
    `🔢 ICCID: \`${iccid}\`\n` +
    `📅 Истекает: *${expireDate}*\n` +
    `⏳ Осталось дней: *${daysLeft}*\n` +
    `💡 Внесите оплату за мониторинг`,

  alertSimExpired: (iccid, deviceLocation) =>
    `🚫 *SIM-КАРТА ИСТЕКЛА — ВНЕСИТЕ ОПЛАТУ*\n` +
    `📍 ${deviceLocation}\n` +
    `🔢 ICCID: \`${iccid}\`\n` +
    `💡 Внесите оплату за мониторинг немедленно`,

  alertWaterLevel: (deviceId, location, level) =>
    `🚱 *ПРОБЛЕМА С УРОВНЕМ ВОДЫ*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `📊 Статус: ${level}\n` +
    `💡 Проверьте кран подачи воды в водомат, работу мембран и насосов`,

  alertWaterPressure: (deviceId, location, pressure) =>
    `💨 *ПРОБЛЕМА С ДАВЛЕНИЕМ ВОДЫ*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `📊 Статус давления: ${pressure}\n` +
    `💡 Проверьте подключение водопровода`,

  alertResolved: (deviceId, location, type) =>
    `✅ *ПРОБЛЕМА УСТРАНЕНА*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `🔧 Тип: ${type}`,
};