const db = require("./db");

async function deleteRow() {
  const [ip] = process.argv.slice(2);
  db.run(`DELETE FROM authentification WHERE ip = ?`, [id], function (error) {
    if (error) {
      return console.error(error.message);
    }
    console.log(`Row with the ID ${ip} has been deleted`);
  });
}

deleteRow();