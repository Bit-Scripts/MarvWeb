const db = require("./db");

function updateRow() {
  const [ip, token] = process.argv.slice(2);
  db.run(
    `UPDATE authentification SET token = ? WHERE ip = ?`,
    [token, ip],
    function (error) {
      if (error) {
        console.error(error.message);
      }
      console.log(`Row ${ip} has been updated`);
    }
  );
}

updateRow();