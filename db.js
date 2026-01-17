// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// FORCE le chemin vers la racine du projet, peu importe d'où le script est appelé
// process.cwd() renvoie le dossier où vous avez lancé la commande npm start
const dbPath = path.join(process.cwd(), 'fish.db'); 

console.log('--- DB PATH:', dbPath); // LOG DE DEBUG CRUCIAL

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('❌ Erreur ouverture fish.db:', err.message);
    else console.log('✅ Connecté à fish.db');
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