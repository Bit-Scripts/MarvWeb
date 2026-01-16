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

const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: ['https://marv-bot.fr', 'http://marv-bot.fr', 'http://localhost:3017'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// ========================================
// BASE DE DONNÉES SQLite
// ========================================

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./fish.db', (err) => {
  if (err) {
    console.error('❌ Erreur ouverture fish.db:', err.message);
  } else {
    console.log('✅ Connecté à fish.db');
    initTables();
  }
});

// Initialisation des tables
function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      token TEXT PRIMARY KEY,
      hashed_ip TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('❌ Erreur création table users:', err);
    else console.log('✅ Table users OK');
  });
  
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL,
      message TEXT NOT NULL,
      response TEXT,
      latitude REAL,
      longitude REAL,
      timezone TEXT,
      hashed_ip TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (token) REFERENCES users(token)
    )
  `, (err) => {
    if (err) console.error('❌ Erreur création table conversations:', err);
    else console.log('✅ Table conversations OK');
  });
}

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

// Fonction pour hasher l'IP de manière sécurisée
function hashIP(ip) {
  const salt = process.env.IP_SALT || 'votre-salt-secret-par-defaut-a-changer';
  return crypto
    .createHmac('sha256', salt)
    .update(ip)
    .digest('hex');
}

// Fonction pour générer un token unique
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
  
  // Récupère l'IP réelle (derrière Cloudflare/proxy)
  const realIP = req.headers['cf-connecting-ip'] || 
                 req.headers['x-forwarded-for']?.split(',')[0] || 
                 req.ip;
  
  // Hash l'IP pour la vie privée
  const hashedIP = hashIP(realIP);
  
  if (!token) {
    // Génère un nouveau token si pas de cookie
    token = generateUniqueToken();
    res.cookie('marvToken', token, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 an
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // Sauvegarde en DB
    db.run(
      `INSERT INTO users (token, hashed_ip) VALUES (?, ?)`,
      [token, hashedIP],
      (err) => {
        if (err) console.error('❌ Erreur insertion user:', err);
        else console.log('🆕 Nouveau utilisateur créé:', token.substring(0, 8) + '...');
      }
    );
  } else {
    // Met à jour last_seen
    db.run(
      `UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE token = ?`,
      [token],
      (err) => {
        if (err) console.error('❌ Erreur update last_seen:', err);
      }
    );
  }
  
  // Ajoute le token et l'IP hashée à la requête
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

// healthcheck d'abord
app.get('/healthz', (req, res) => res.status(200).send('ok'));

// Routes API
app.use('/', indexRouter);
app.get('/', (req, res) => res.redirect('/legacy'));
app.use('/users', usersRouter);

app.get('/get-prompt', (req, res) => {
  const prompt = req.cookies.chatgptPrompt;
  promptStore.setPrompt(prompt);
  res.send(`Le prompt stocké est : ${prompt}`);
});

// Route de debug/stats
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

// fallback SPA
app.get(/^\/(?!api|users|legacy|privacy|socket\.io).*/, (req, res, next) => {
  if (req.path.includes('.')) return next();
  return res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ========================================
// GESTION SOCKET.IO
// ========================================

io.on('connection', (socket) => {
    console.log('✅ Client Socket.IO connecté:', socket.id);
    
    socket.on('marv', async (data) => {
        console.log('📨 Message reçu:', data.message);
        console.log('🔑 Token:', data.token ? data.token.substring(0, 8) + '...' : 'aucun');
        console.log('🔒 IP hashée:', data.ip ? data.ip.substring(0, 8) + '...' : 'aucune');
        console.log('🌍 Position:', data.latitude, data.longitude);
    
        const token = data.token;
    
        if (!token) {
            console.warn('⚠️ Pas de token fourni');
            socket.emit('marv', 'Erreur: Session invalide. Veuillez recharger la page.');
            return;
        }
    
        // Vérifie si l'utilisateur existe en DB
        db.get(
        `SELECT * FROM users WHERE token = ?`,
            [token],
            async (err, user) => {
            if (err) {
                console.error('❌ Erreur DB:', err);
                socket.emit('marv', 'Erreur serveur. Veuillez réessayer.');
                return;
            }
            
            if (!user) {
                console.warn('⚠️ Token inconnu:', token.substring(0, 8) + '...');
                socket.emit('marv', 'Erreur: Session invalide. Veuillez recharger la page.');
                return;
            }
            
            // Vérification optionnelle: l'IP hashée correspond-elle ?
            if (user.hashed_ip !== data.ip) {
                console.warn('⚠️ IP hashée différente pour ce token');
                // Vous pouvez choisir de rejeter ou d'accepter quand même
            }
            
            // Sauvegarde la conversation en DB
            db.run(
                `INSERT INTO conversations (token, message, latitude, longitude, timezone, hashed_ip) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [token, data.message, data.latitude, data.longitude, data.tz, data.ip],
                function(err) {
                    if (err) {
                    console.error('❌ Erreur sauvegarde conversation:', err);
                    socket.emit('marv', 'Erreur lors de la sauvegarde. Veuillez réessayer.');
                    return;
                    }
                
                const conversationId = this.lastID;
                console.log('💾 Conversation sauvegardée, ID:', conversationId);
                
                // ========================================
                // ICI : AJOUTEZ VOTRE LOGIQUE MARV/OpenAI
                // ========================================
                
                // Exemple de réponse
                const response = `Vous avez dit: "${data.message}". Message sauvegardé avec l'ID ${conversationId}.`;
                
                // Sauvegarde la réponse en DB
                db.run(
                    `UPDATE conversations SET response = ? WHERE id = ?`,
                    [response, conversationId],
                    (err) => {
                        if (err) console.error('❌ Erreur sauvegarde réponse:', err);
                    }
                    );
                    
                    socket.emit('marv', response);
                }
                );
            }
        );
    });

    socket.on('promptValue', (data) => {
        console.log('🔧 Prompt reçu:', data.prompt);
        // Logique pour gérer le prompt personnalisé
        // Vous pouvez sauvegarder dans fish.db aussi si besoin
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Client déconnecté:', socket.id);
    });
});

// ========================================
// GESTION D'ERREURS
// ========================================

// 404
app.use((req, res, next) => next(createError(404)));

// handler erreur
app.use((err, req, res, next) => {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.render('error');
});

// Fermeture propre de la DB à l'arrêt
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