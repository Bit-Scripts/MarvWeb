var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var token = "";
var database = require("../db");

/* GET home page. */
router.get('/', function(req, res, next) {
  var ip = req.headers['CF-Connecting-IP'] || req.socket.remoteAddress;
  res.header("Access-Control-Allow-Origin", ip);
  var ip = crypto.createHash('sha1').update(ip).digest('base64');
  token = crypto.randomBytes(64).toString('hex');
  db = database.createDbConnection();
  db.serialize(() => {
    const stmt = db.prepare("INSERT INTO authentification (ip, token) VALUES (?,?)");
    stmt.run(ip, token);
    stmt.finalize();
  });
  db.close();
  res.render('index', { title: 'Marv Web', ip: `${ip}` });
});

module.exports = router, token;
