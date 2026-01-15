// config.js
const fs = require('fs');
const path = require('path');

let fileConfig = {};
const configPath = path.join(__dirname, 'config.json');

if (fs.existsSync(configPath)) {
  try {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.warn('config.json illisible, on ignore.');
  }
}

function pick(name, fallback = '') {
  return process.env[name] ?? fileConfig[name] ?? fallback;
}

module.exports = {
  OPENAI_API_KEY: pick('OPENAI_API_KEY'),
  organization: pick('organization'),
  API_NEWS: pick('API_NEWS'),
};
