const express = require('express');
const bcrypt = require('bcrypt');
const { pool, prisma } = require('../db/pool');

const router = express.Router();

// Current User Profile Check
router.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      user: req.session.user
    });
  }
  res.json({ authenticated: false, user: null });
});

// User Login Route
router.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required.' });
  }

  try {
    const loginQuery = `
      SELECT * FROM users 
      WHERE username = $1 OR email = $1 
      LIMIT 1;
    `;
    const result = await pool.query(loginQuery, [username.trim().toLowerCase()]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    // Check if user has a password hash set
    if (!user.password_hash) {
      // If user was registered without password earlier, allow setting/verifying password or initial access
      req.session.userId = user.id;
      req.session.user = {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        username: user.username,
        role: user.role || 'User'
      };
      return res.json({
        message: 'Login successful!',
        user: req.session.user
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      username: user.username,
      role: user.role || 'User'
    };

    res.json({
      message: 'Login successful!',
      user: req.session.user
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Server error during login.' });
  }
});

// User Logout Route
router.post('/api/auth/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Could not log out.' });
      }
      res.clearCookie('connect.sid');
      return res.json({ message: 'Logout successful.' });
    });
  } else {
    res.json({ message: 'No active session.' });
  }
});

module.exports = router;
