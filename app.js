var cloudflare = require('cloudflare-express');
var createError = require('http-errors');
var express = require('express');
const path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var favicon = require('serve-favicon');
const promptStore = require('./promptStore');

var usersRouter = require('./routes/users');
const indexRouter = require('./routes/index');

var app = express();

// Configuration
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('trust proxy', 1);

// Middlewares
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(cloudflare.restore());

// Statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'dist')));

// healthcheck d'abord
app.get('/healthz', (req, res) => res.status(200).send('ok'));

// Routes API
app.use('/', indexRouter);        // /legacy, /privacy, /store-prompt, etc.
app.get('/', (req, res) => res.redirect('/legacy'));
app.use('/users', usersRouter);

app.get('/get-prompt', (req, res) => {
  const prompt = req.cookies.chatgptPrompt;
  promptStore.setPrompt(prompt);
  res.send(`Le prompt stocké est : ${prompt}`);
});

// Si tu veux garder des routes express "classiques" (optionnel)
// app.use('/api', indexRouter); // par ex, mais attention a ne pas prendre '/'


// fallback SPA: uniquement sur les GET qui ne sont pas une API et pas un fichier
app.get(/^\/(?!api|users|legacy|privacy|socket\.io).*/, (req, res, next) => {
  if (req.path.includes('.') ) return next(); // laisse passer les assets
  return res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// 404
app.use((req, res, next) => next(createError(404)));

// handler erreur
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);

  // si tu veux une page erreur SPA en prod, tu peux renvoyer dist/index.html au lieu de render
  res.render('error');
});

module.exports = app;
