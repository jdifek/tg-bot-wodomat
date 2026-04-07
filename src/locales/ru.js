// src/locales/ru.js — Русский язык

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

  authFailed:
    `❌ Не удалось подключиться к API.\n\nПроверьте правильность данных в ссылке или обратитесь к администратору.`,

  settingsSaved: `✅ Настройки сохранены.`,

  // ---- Команды ----
  cmdStatus: `📊 *Статус мониторинга*`,
  cmdHelp:
    `📖 *Доступные команды:*\n\n` +
    `/status — статус мониторинга и список аппаратов\n` +
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
  devicesHeader: `📟 *Список аппаратов:*\n`,
  deviceLine: (id, location, status) =>
    `${status === 'online' ? '🟢' : '🔴'} \`${id}\` — ${location}`,
  devicesEmpty: `Аппараты не найдены.`,

  // ---- Отчёт продаж ----
  reportHeader: (date) => `📊 *Отчёт продаж за ${date}*\n`,
  reportLine: (location, liters, amount) =>
    `📍 ${location}\n   💧 ${liters} л  |  💰 ${amount} zł`,
  reportTotal: (liters, amount) =>
    `\n━━━━━━━━━━━━━━\n` +
    `📦 *Итого:* ${liters} л  |  💰 ${amount} zł`,
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

  // 1. Нет воды / бак наполняется
  alertNoWater: (deviceId, location) =>
    `🚱 *НЕТ ВОДЫ В БАКЕ*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💡 Проверьте кран подачи воды, работу мембран и насосов`,

  // 2. Продажа без розлива
  alertNoDispense: (deviceId, location, amount) =>
    `💸 *ПРОДАЖА БЕЗ РОЗЛИВА*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💰 Сумма оплаты: ${amount} zł\n` +
    `💡 Проведена оплата, но вода не выдана — проверьте аппарат`,

  // 3а. Низкая температура
  alertTempLow: (deviceId, location, temp) =>
    `🥶 *НИЗКАЯ ТЕМПЕРАТУРА*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `🌡 Температура: *${temp}°C*\n` +
    `💡 Проверьте электричество и систему обогрева водомата`,

  // 3б. Высокая температура
  alertTempHigh: (deviceId, location, temp) =>
    `🔥 *ВЫСОКАЯ ТЕМПЕРАТУРА*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `🌡 Температура: *${temp}°C*\n` +
    `💡 Проверьте систему охлаждения и вентиляцию`,

  // 4. Оффлайн более 15 минут
  alertOffline: (deviceId, location, minutes) =>
    `📵 *АППАРАТ НЕ НА СВЯЗИ*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `⏱ Не выходил на связь: *${minutes} мин.*\n` +
    `💡 Проверьте подачу электричества или работу SIM-карты`,

  // 5. Ежедневный отчёт продаж
  dailyReportHeader: (date) =>
    `📊 *ОТЧЁТ ПРОДАЖ ЗА ${date}*\n━━━━━━━━━━━━━━━━━━━━`,

  dailyReportLine: (location, liters, amount) =>
    `📍 *${location}*\n   💧 ${liters} л  💰 ${amount} zł`,

  dailyReportTotal: (liters, amount) =>
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *ИТОГО:* ${liters} л  |  💰 *${amount} zł*`,

  dailyReportEmpty: `📊 *Отчёт за вчера:* продаж не зафиксировано.`,

  // 6. Статус онлайн/оффлайн (периодический)
  alertStatusOnline: (deviceId, location) =>
    `🟢 *АППАРАТ СНОВА ОНЛАЙН*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\``,

  alertStatusOfflineShort: (deviceId, location) =>
    `🔴 *АППАРАТ ОФФЛАЙН*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💡 Возможно есть проблемы с аппаратом`,

  // 7. QR пополнение
  alertQrPayment: (deviceId, location, amount) =>
    `💳 *УДАЛЁННОЕ ПОПОЛНЕНИЕ QR*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `💰 Сумма: *${amount} zł*`,

  // 8. Истекает оплата мониторинга (SIM)
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

  // Аномалии воды/давления из API
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

  // Проблема восстановлена
  alertResolved: (deviceId, location, type) =>
    `✅ *ПРОБЛЕМА УСТРАНЕНА*\n` +
    `📍 ${location}\n` +
    `🔧 ID: \`${deviceId}\`\n` +
    `🔧 Тип: ${type}`,
};
