var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var database = require("../db");

/* GET home page. */
router.get('/legacy', function(req, res) {
  let ip = req.headers['x-real-ip'] || req.connection.remoteAddress;

  // (CORS: ton Access-Control-Allow-Origin = ip c'est chelou, je te conseille de le virer)
  // res.header("Access-Control-Allow-Origin", ip);

  const ipHash = crypto.createHash('sha1').update(ip).digest('base64');
  const token = crypto.randomBytes(64).toString('hex');

  const db = database.createDbConnection();
  db.serialize(() => {
    const stmt = db.prepare("INSERT OR REPLACE INTO authentification (ip, token) VALUES (?,?)");
    stmt.run(ipHash, token);
    stmt.finalize();
  });
  db.close();

  res.render('index', { title: 'Marv Web', ip: ipHash, token });
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

module.exports = { router, getToken };