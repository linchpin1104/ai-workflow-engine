const express = require('express');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const { invalidateCache } = require('../utils/apiKeyCache');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const fs = require('fs');
const router = express.Router();

const API_KEYS = ['openai_api_key', 'google_api_key', 'anthropic_api_key'];

// Get API keys (masked)
router.get('/keys', protect, adminOnly, (req, res) => {
  const keyPlaceholders = API_KEYS.map(() => '?').join(',');
  db.all(
    `SELECT key, value FROM settings WHERE key IN (${keyPlaceholders})`,
    API_KEYS,
    (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      const settings = rows.reduce((acc, row) => {
        acc[row.key] = row.value ? `****${row.value.slice(-4)}` : '';
        return acc;
      }, {});
      API_KEYS.forEach((key) => {
        if (!settings[key]) {
          settings[key] = '';
        }
      });
      res.json(settings);
    }
  );
});

// Update API keys
router.put('/keys', protect, adminOnly, (req, res) => {
  const keysToUpdate = API_KEYS.filter(
    (key) => req.body[key] && typeof req.body[key] === 'string'
  ).map((key) => ({ key, value: req.body[key] }));

  if (keysToUpdate.length === 0) {
    return res
      .status(400)
      .json({ message: 'No valid API keys provided to update.' });
  }

  db.serialize(() => {
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
    );
    keysToUpdate.forEach(({ key, value }) => {
      stmt.run(key, value);
    });
    stmt.finalize((err) => {
      if (err) {
        logger.error('Failed to update API keys', {
          user: req.user.username,
          error: err.message,
        });
        return res.status(500).json({ message: err.message });
      }
      invalidateCache();
      logger.info('API keys updated', { user: req.user.username });
      res.json({ message: 'API keys saved successfully' });
    });
  });
});

// Get logs
router.get('/logs', protect, adminOnly, (req, res) => {
  const LOG_FILE = './activity.log';
  fs.readFile(LOG_FILE, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT')
        return res
          .header('Content-Type', 'text/plain')
          .send('Log file is empty.');
      return res.status(500).json({ message: 'Could not read log file.' });
    }
    res.header('Content-Type', 'text/plain').send(data);
  });
});

module.exports = router;
