var cloudflare = require('cloudflare-express');
var createError = require('http-errors');
const path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var favicon = require('serve-favicon');
const crypto = require('crypto'); // ← IMPORTANT !
const { Marv } = require('./marv');
const promptStore = require('./promptStore');
const { db } = require('./db');

var usersRouter = require('./routes/users');
const indexRouter = require('./routes/index');

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, {
  cors: {
    origin: ['https://marv-bot.fr', 'http://marv-bot.fr', 'http://localhost:3017'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

function hashIP(ip) {
  const salt = process.env.IP_SALT || 'change-me';
  return crypto
    .createHmac('sha256', salt)
    .update(ip)
    .digest('hex');
}

function generateUniqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ========================================
// CONFIGURATION EXPRESS
// ========================================

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

// ========================================
// MIDDLEWARE TOKEN & IP HASHÉE
// ========================================

app.use((req, res, next) => {
  let token = req.cookies.marvToken;
  
  const realIP = req.headers['cf-connecting-ip'] || 
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
    
    db.run(
      `INSERT INTO users (token, hashed_ip) VALUES (?, ?)`,
      [token, hashedIP],
      (err) => {
        if (err) console.error('❌ Erreur insertion user:', err);
        else console.log('🆕 Nouveau utilisateur créé:', token.substring(0, 8) + '...');
      }
    );
  } else {
    db.run(
      `UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE token = ?`,
      [token],
      (err) => {
        if (err) console.error('❌ Erreur update last_seen:', err);
      }
    );
  }
  
  req.userToken = token;
  req.hashedIP = hashedIP;
  next();
});

// ========================================
// FICHIERS STATIQUES
// ========================================

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'dist')));

// ========================================
// ROUTES
// ========================================

app.get('/healthz', (req, res) => res.status(200).send('ok'));

app.use('/', indexRouter);
app.get('/', (req, res) => res.redirect('/legacy'));
app.use('/users', usersRouter);

app.get('/get-prompt', (req, res) => {
  const prompt = req.cookies.chatgptPrompt;
  promptStore.setPrompt(prompt);
  res.send(`Le prompt stocké est : ${prompt}`);
});

app.get('/debug-stats', (req, res) => {
  db.all(
    `SELECT 
      COUNT(DISTINCT token) as total_users,
      COUNT(*) as total_conversations,
      DATE(created_at) as date,
      COUNT(*) as conversations_per_day
    FROM conversations 
    GROUP BY DATE(created_at) 
    ORDER BY date DESC 
    LIMIT 30`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get(/^\/(?!api|users|legacy|privacy|socket\.io).*/, (req, res, next) => {
  if (req.path.includes('.')) return next();
  return res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ========================================
// SOCKET.IO
// ========================================

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("NO_TOKEN"));
  }
  next();
});

io.on('connection', (socket) => {
  const token = socket.handshake.auth?.token;

  console.log('✅ socket connected', socket.id, 'auth.token=', token?.substring(0, 8));

  // Crée l'utilisateur à la connexion si pas déjà fait
  if (token) {
    db.run(`INSERT OR IGNORE INTO users (token, hashed_ip) VALUES (?, ?)`, [token, null]);
  }

  socket.on('marv', async (data) => {
    const realIP =
      socket.handshake.headers['cf-connecting-ip'] ||
      (socket.handshake.headers['x-forwarded-for'] ? String(socket.handshake.headers['x-forwarded-for']).split(',')[0].trim() : '') ||
      socket.request?.socket?.remoteAddress ||
      '';

    const hashedIP = hashIP(realIP);

    if (!token) {
      socket.emit('marv', 'Erreur: Session invalide. Recharge la page.');
      return;
    }

    console.log('📨 Message reçu:', data.message);
    console.log('🔑 Token:', token.substring(0, 8) + '...');
    console.log('🔒 IP hashée:', hashedIP.substring(0, 8) + '...');
    console.log('🌍 Position:', data.latitude, data.longitude);

    db.get(`SELECT token FROM users WHERE token = ?`, [token], async (err, user) => {
      if (err) {
        console.error('❌ DB error:', err);
        socket.emit('marv', 'Erreur serveur.');
        return;
      }
      if (!user) {
        socket.emit('marv', 'Erreur: Session invalide. Recharge la page.');
        return;
      }

      // Sauvegarde la conversation
      db.run(
        `INSERT INTO conversations (token, message, latitude, longitude, timezone, hashed_ip)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [token, data.message, data.latitude, data.longitude, data.tz, hashedIP],
        async function (err) {
          if (err) {
            console.error('❌ insert conversation error:', err);
            socket.emit('marv', 'Erreur sauvegarde.');
            return;
          }

          const conversationId = this.lastID;
          console.log('💾 Conversation sauvegardée, ID:', conversationId);

          try {
            // ========================================
            // APPEL À MARV (votre logique IA)
            // ========================================
            const marv = new Marv();
            const response = await marv.chat(data.message, {
              token,
              latitude: data.latitude,
              longitude: data.longitude,
              timezone: data.tz
            });

            // Sauvegarde la réponse
            db.run(
              `UPDATE conversations SET response = ? WHERE id = ?`,
              [response, conversationId],
              (err) => {
                if (err) console.error('❌ update response error:', err);
              }
            );

            socket.emit('marv', response);

          } catch (error) {
            console.error('❌ Marv error:', error);
            socket.emit('marv', 'Désolé, une erreur est survenue.');
          }
        }
      );
    });
  });

  socket.on('promptValue', (data) => {
    console.log('🔧 Prompt reçu:', data.prompt);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ socket disconnected', socket.id, reason);
  });
});

// ========================================
// GESTION D'ERREURS
// ========================================

app.use((req, res, next) => next(createError(404)));

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// Fermeture propre
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('❌ Erreur fermeture DB:', err);
    else console.log('✅ DB fermée proprement');
    process.exit(0);
  });
});

// ========================================
// EXPORT
// ========================================

module.exports = { app, server, io };