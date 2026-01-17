// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o777 });
}

const dbPath = path.join(dataDir, 'fish.db');

// Utilisation de drapeaux explicites pour l'ouverture
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('❌ Erreur SQLITE_CANTOPEN:', err.message);
        console.error('Vérifiez les droits sur:', dbPath);
    } else {
        // Mode WAL : Indispensable dans Docker pour éviter les "Database is locked"
        db.run("PRAGMA journal_mode = WAL;");
        console.log('✅ DB connectée avec succès sur:', dbPath);
    }
});

function initTables() {
    db.serialize(() => { // serialize assure que les tables sont créées dans l'ordre
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
    });
}

module.exports = { db, initTables };