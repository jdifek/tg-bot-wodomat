const fs = require('fs');
const path = require('path');

const LOCK_FILE = path.join('/tmp', 'bot.lock');

function acquireLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = fs.readFileSync(LOCK_FILE, 'utf8');
      console.log(`Lock file exists with PID: ${pid}`);
      
      // Проверяем, жив ли процесс
      try {
        process.kill(pid, 0);
        console.log('Another instance is running');
        return false;
      } catch (e) {
        console.log('Stale lock file, removing...');
        fs.unlinkSync(LOCK_FILE);
      }
    }
    
    fs.writeFileSync(LOCK_FILE, process.pid.toString());
    console.log(`Lock acquired for PID: ${process.pid}`);
    return true;
  } catch (err) {
    console.error('Failed to acquire lock:', err);
    return false;
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
      console.log('Lock released');
    }
  } catch (err) {
    console.error('Failed to release lock:', err);
  }
}

module.exports = { acquireLock, releaseLock };