const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const { protect } = require('../middleware/authMiddleware');
const { addToBlacklist } = require('../utils/jwtBlacklist'); // --- IMPROVEMENT ---
const router = express.Router();

router.post('/register', (req, res) => {
  const { username, password } = req.body;
  const role = 'user';
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: 'Username and password are required' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  db.run(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    [username, passwordHash, role],
    function (err) {
      if (err) {
        logger.warn('User registration failed', {
          username,
          error: err.message,
        });
        return res.status(400).json({ message: 'Username already exists' });
      }
      logger.info('User registered successfully', {
        userId: this.lastID,
        username,
      });
      res.status(201).json({ id: this.lastID, username });
    }
  );
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user || !bcrypt.compareSync(password, user.password_hash)) {
      logger.warn('Login failed for user', { username });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { userId: user.id, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    logger.info('Login successful', { username, role: user.role });
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  });
});

// --- IMPROVEMENT ---
// 로그아웃 시 토큰을 블랙리스트에 추가하여 즉시 무효화시키는 엔드포인트
router.post('/logout', protect, (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    addToBlacklist(token);
    logger.info('User logged out and token blacklisted', {
      username: req.user.username,
    });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Error during logout', {
      username: req.user.username,
      error: error.message,
    });
    res.status(500).json({ message: 'Logout failed' });
  }
});

router.get('/verify', protect, (req, res) => {
  db.get(
    'SELECT id, username, role FROM users WHERE id = ?',
    [req.user.userId],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({ user });
    }
  );
});

module.exports = router;
