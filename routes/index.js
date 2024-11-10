var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var token = crypto.randomBytes(64).toString('hex');
var database = require("../db");

/* GET home page. */
router.get('/', function(req, res, next) {
  var ip = req.headers['x-real-ip'] || req.connection.remoteAddress;
  res.header("Access-Control-Allow-Origin", ip);
  console.log(ip);
  ip = crypto.createHash('sha1').update(ip).digest('base64');
  db = database.createDbConnection();
  db.serialize(() => {
    const stmt = db.prepare("INSERT OR REPLACE INTO authentification (ip, token) VALUES (?,?)");
    stmt.run(ip, token);
    stmt.finalize();
  });
  db.close();
  res.render('index', { title: 'Marv Web', ip: `${ip}` });
});

router.post('/store-prompt', function(req, res) {
  const prompt = req.body.prompt;
  console.log('prompt :', prompt)
  // Logique pour traiter le prompt
  res.cookie('chatgptPrompt', prompt, { maxAge: 900000, httpOnly: true });
  res.send('Prompt stocké dans un cookie');
});

/* GET privacy policy and terms of service page. */
router.get('/privacy', function(req, res, next) {
  res.render('privacy', { title: 'Politique de Confidentialité & CGU' });
});

const getToken = () => { return token; }

module.exports = { router, getToken };