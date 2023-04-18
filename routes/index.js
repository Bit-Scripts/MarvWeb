var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var token = "";
var database = require("../db");

/* GET home page. */
router.get('/', function(req, res, next) {
  //var ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
  //var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  //var ip = req.ip;
  var ip = req.headers['x-real-ip'] || req.connection.remoteAddress;
  res.header("Access-Control-Allow-Origin", ip);
  ip = crypto.createHash('sha1').update(ip).digest('base64');
  token = crypto.randomBytes(64).toString('hex');
  db = database.createDbConnection();
  db.serialize(() => {
    const stmt = db.prepare("INSERT OR REPLACE INTO authentification (ip, token) VALUES (?,?)");
    stmt.run(ip, token);
    stmt.finalize();
  });
  db.close();
  res.render('index', { title: 'Marv Web', ip: `${ip}` });
});

module.exports = router, token;
