const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFile(config.log.file, logMessage, (err) => {
        if (err) console.error('Error writing to log file:', err);
    });
}

module.exports = { log };