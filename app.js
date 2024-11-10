var cloudflare = require('cloudflare-express');
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var favicon = require('serve-favicon');
const promptStore = require('./promptStore');

// var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const { router: indexRouter, getToken } = require('./routes/index');

var app = express();

// Configuration de l'application
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('trust proxy', 'loopback');

// Middlewares
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(cloudflare.restore());
app.use(express.static(path.join(__dirname, 'public')));


// Routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.get('/get-token', getToken);
app.get('/get-prompt', (req, res) => {
  const prompt = req.cookies.chatgptPrompt;
  promptStore.setPrompt(prompt); // Stocker le prompt
  res.send(`Le prompt stocké est : ${prompt}`);
});

// Gestion des erreurs
app.use((req, res, next) => next(createError(404)));
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
