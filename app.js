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
  return crypto.createHmac('sha256', salt).update(ip).digest('hex');
}

function generateUniqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('trust proxy', 1);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(cloudflare.restore());

// token + ip hash
app.use((req, res, next) => {
  let token = req.cookies.marvToken;

  const realIP =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.ip;

  const hashedIP = hashIP(realIP);

  if (!token) {
    token = generateUniqueToken();
    res.cookie('marvToken', token, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    db.run(`INSERT INTO users (token, hashed_ip) VALUES (?, ?)`, [token, hashedIP]);
  } else {
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
app.use('/', indexRouter);
app.get('/', (req, res) => res.redirect('/legacy'));
app.use('/users', usersRouter);

app.get('/get-prompt', (req, res) => {
  const prompt = req.cookies.chatgptPrompt;
  promptStore.setPrompt(prompt);
  res.send(`Le prompt stocké est : ${prompt}`);
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
