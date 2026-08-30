const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./db/pool');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure session storage in PostgreSQL using connect-pg-simple
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'postgreflow-secret-key-change-in-prod-12345',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true',
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
