// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Utilisation du dossier /app/data qui sera monté comme volume dans Coolify
const dataDir = path.join(process.cwd(), 'data');

if (!fs.existsSync(dataDir)){
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'fish.db'); 
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('❌ Erreur:', err.message);
    else console.log('✅ DB persistante connectée sur ' + dbPath);
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