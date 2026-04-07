// src/logger.js
'use strict';

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

const logFmt = printf(({ level, message, timestamp }) =>
  `${timestamp} [${level}] ${message}`
);

const logger = createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    colorize(),
    logFmt
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Создать папку logs если нет
const fs = require('fs');
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

module.exports = logger;
