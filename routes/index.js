var express = require('express');
var router = express.Router();

router.get('/legacy', (req, res) => {
  res.render('index', {
    title: 'MarvBot',
    token: req.userToken,
    hashedIP: req.hashedIP
  });
});

router.get('/privacy', (req, res) => {
  res.render('privacy', { title: 'Politique de Confidentialité' });
});

router.post('/store-prompt', (req, res) => {
  const prompt = req.body.prompt;
  res.cookie('chatgptPrompt', prompt, {
    maxAge: 365 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  res.send('Prompt stocké avec succès');
});

module.exports = router;
