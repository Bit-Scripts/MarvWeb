// app.js
var cloudflare = require('cloudflare-express');
var createError = require('http-errors');
const path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var favicon = require('serve-favicon');
const crypto = require('crypto');
const promptStore = require('./promptStore');

var usersRouter = require('./routes/users');
const indexRouter = require('./routes/index');

const { db, initTables } = require('./db');
initTables();

const express = require('express');
const app = express();

function hashIP(ip) {
  const salt = process.env.IP_SALT || 'change-me';
  return crypto.createHmac('sha256', salt).update(ip || '').digest('hex');
}

function generateUniqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getRealIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    (req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : '') ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('trust proxy', 1);

// IMPORTANT: cookieParser une seule fois, au debut
app.use(cookieParser());

// cloudflare restore avant de lire l'ip
app.use(cloudflare.restore());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// session (UNIQUE)
app.use((req, res, next) => {
  const realIP = getRealIp(req);
  const hashedIP = hashIP(realIP);

  let token = req.cookies?.marvToken;

  if (!token) {
    token = generateUniqueToken();

    // cookie secure en prod + httpOnly true (le client ne le lit pas directement)
    res.cookie('marvToken', token, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // evite les erreurs si token existe deja (rare mais possible)
    db.run(`INSERT OR IGNORE INTO users (token, hashed_ip) VALUES (?, ?)`, [token, hashedIP]);
  } else {
    // si tu veux, tu peux aussi maj hashed_ip ici (optionnel)
    db.run(`UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE token = ?`, [token]);
  }

  req.userToken = token;
  req.hashedIP = hashedIP;
  next();
});

// statics
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'dist')));

// healthcheck
app.get('/healthz', (req, res) => res.status(200).send('ok'));

// routes
app.get('/', (req, res) => res.redirect('/legacy'));
app.use('/', indexRouter);
app.use('/users', usersRouter);

app.get('/get-prompt', (req, res) => {
  const prompt = req.cookies.chatgptPrompt;
  promptStore.setPrompt(prompt);
  res.send(`Le prompt stocké est : ${prompt}`);
});

// utile pour debug + client (si DOM vide)
app.get('/api/session', (req, res) => {
  res.json({
    token: req.userToken,
    hashedIP: req.hashedIP
  });
});

// fallback SPA
app.get(/^\/(?!api|users|legacy|privacy|socket\.io).*/, (req, res, next) => {
  if (req.path.includes('.')) return next();
  return res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.use((req, res, next) => next(createError(404)));
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
