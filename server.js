const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./db/pool');
require('dotenv').config();

// Global crash-prevention error handlers for Docker container stability
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception in server:', err.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection in server:', reason);
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure session store with error safety
const sessionStore = new pgSession({
  pool,
  tableName: 'session',
  createTableIfMissing: true,
  error: (err) => {
    console.warn('⚠️ Session store warning:', err ? err.message : err);
  }
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'postgreflow-secret-key-change-in-prod-12345',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: false, // Set false so HTTP connections work seamlessly across local IP & Cloudflare
    sameSite: 'lax'
  }
}));

// Mount Routes
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/api'));

// Explicit root route serving frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Form & PostgreSQL Visualizer running on http://localhost:${PORT}`);
});
