const db = require("./db");

function insertRow() {
    const [ip, token] = process.argv.slice(2);
    db.run(
        `INSERT INTO authentification (ip, token) VALUES (?, ?)`,
        [ip, token],
        function (error) {
        if (error) {
            console.error(error.message);
        }
        console.log(`Inserted a row with the ID: ${this.lastID}`);
        }
    );
}

insertRow();