const db = require("./db");

function getToken() {
    const [ip] = process.argv.slice(2);
    db.each(`SELECT token FROM authentification WHERE ip`, [ip], (error, token) => {
        if (error) {
            throw new Error(error.message);
        }
        console.log(token);
        return token;
    });
}

getToken();