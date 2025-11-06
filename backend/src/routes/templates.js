const express = require('express');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const router = express.Router();

const parseConfig = (row) => ({ ...row, config: JSON.parse(row.config) });

router.get('/', protect, (req, res) => {
  const { role, userId } = req.user;

  let query;
  const params = [];

  if (role === 'master' || role === 'admin') {
    query = 'SELECT * FROM templates ORDER BY name';
  } else {
    query = `SELECT t.* FROM templates t JOIN user_template_permissions utp ON t.id = utp.template_id WHERE utp.user_id = ? ORDER BY t.name`;
    params.push(userId);
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows.map(parseConfig));
  });
});

router.get('/:id', protect, adminOnly, (req, res) => {
  db.get(
    'SELECT * FROM templates WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ message: err.message });
      if (!row) return res.status(404).json({ message: 'Template not found' });
      res.json(parseConfig(row));
    }
  );
});

router.post('/', protect, adminOnly, (req, res) => {
  const { name, config } = req.body;
  db.run(
    'INSERT INTO templates (name, config, created_by) VALUES (?, ?, ?)',
    [name, JSON.stringify(config), req.user.userId],
    function (err) {
      if (err)
        return res
          .status(400)
          .json({ message: 'Template name already exists' });
      logger.info('Template created', {
        user: req.user.username,
        templateName: name,
      });
      res.status(201).json({ id: this.lastID, name, config });
    }
  );
});

router.put('/:id', protect, adminOnly, (req, res) => {
  const { name, config } = req.body;
  db.run(
    'UPDATE templates SET name = ?, config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, JSON.stringify(config), req.params.id],
    function (err) {
      if (err) return res.status(500).json({ message: err.message });
      logger.info('Template updated', {
        user: req.user.username,
        templateName: name,
      });
      res.json({ message: 'Template updated successfully' });
    }
  );
});

router.delete('/:id', protect, adminOnly, (req, res) => {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run(
      'DELETE FROM user_template_permissions WHERE template_id = ?',
      [req.params.id],
      (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ message: err.message });
        }
        db.run(
          'DELETE FROM templates WHERE id = ?',
          [req.params.id],
          function (err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ message: err.message });
            }
            db.run('COMMIT');
            logger.info('Template deleted', {
              user: req.user.username,
              templateId: req.params.id,
            });
            res.json({
              message:
                'Template and associated permissions deleted successfully',
            });
          }
        );
      }
    );
  });
});

module.exports = router;
