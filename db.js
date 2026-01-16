// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'fish.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('❌ Erreur ouverture fish.db:', err.message);
    else console.log('✅ Connecté à fish.db');
});

function initTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
        token TEXT PRIMARY KEY,
        hashed_ip TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL,
        message TEXT NOT NULL,
        response TEXT,
        latitude REAL,
        longitude REAL,
        timezone TEXT,
        hashed_ip TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (token) REFERENCES users(token)
        )
    `);
}

module.exports = { db, initTables };
