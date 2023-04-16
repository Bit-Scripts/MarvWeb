const fs = require("fs");
const { Serializer } = require("v8");
const sqlite3 = require("sqlite3").verbose();
const filepath = "./fish.db";

var createDbConnection = () => {
    if (fs.existsSync(filepath)) {
        db = new sqlite3.Database(filepath);
        createTable(db);
        return db;
    } else {
        const db = new sqlite3.Database(filepath, (error) => {
            if (error) {
                return console.error(error.message);
            }
            createTable(db);
        });
        console.log("Connection with SQLite has been established");
        return db;
    }
}

function createTable(db) {
    db.run("CREATE TABLE IF NOT EXISTS authentification (ID INTEGER PRIMARY KEY AUTOINCREMENT, ip   VARCHAR(255) NOT NULL, token VARCHAR(255) NOT NULL)");
}

module.exports = { createDbConnection };