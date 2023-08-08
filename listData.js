const database = require("./db");

function selectRows() {
    db = database.createDbConnection();
    db.each(`SELECT * FROM authentification`, (error, row) => {
        if (error) {
            throw new Error(error.message);
        }
        console.log(row);
    });
}

selectRows();