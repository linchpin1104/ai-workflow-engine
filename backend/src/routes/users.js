const express = require('express');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const { protect, masterOnly } = require('../middleware/authMiddleware');
const router = express.Router();

// Get all users (except master)
router.get('/', protect, masterOnly, (req, res) => {
  db.all(
    "SELECT id, username, role, created_at FROM users WHERE role != 'master'",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows);
    }
  );
});

// --- REFACTOR HIGHLIGHT ---
// 사용자 삭제를 위한 DELETE 엔드포인트를 여기에 추가합니다.
// Master 권한만 호출할 수 있으며, 자기 자신은 삭제할 수 없습니다.
router.delete('/:id', protect, masterOnly, (req, res) => {
  const targetUserId = req.params.id;

  if (req.user.userId === Number(targetUserId)) {
    return res
      .status(400)
      .json({ message: '자기 자신의 계정은 삭제할 수 없습니다.' });
  }

  db.run(
    "DELETE FROM users WHERE id = ? AND role != 'master'",
    [targetUserId],
    function (err) {
      if (err) {
        logger.error('Failed to delete user', {
          admin: req.user.username,
          targetUserId,
          error: err.message,
        });
        return res.status(500).json({ message: err.message });
      }
      // this.changes는 이 쿼리로 인해 변경된 행의 수를 나타냅니다. 0이면 대상이 없다는 의미입니다.
      if (this.changes === 0) {
        return res
          .status(404)
          .json({ message: '사용자를 찾을 수 없거나 마스터 계정입니다.' });
      }
      logger.info('User deleted successfully', {
        admin: req.user.username,
        targetUserId,
      });
      res.json({ message: '사용자가 성공적으로 삭제되었습니다.' });
    }
  );
});

// Update user role
router.put('/:id/role', protect, masterOnly, (req, res) => {
  const { role } = req.body;
  const targetUserId = req.params.id;

  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  if (req.user.userId === Number(targetUserId)) {
    return res.status(400).json({ message: 'Cannot change your own role.' });
  }

  db.run(
    "UPDATE users SET role = ? WHERE id = ? AND role != 'master'",
    [role, targetUserId],
    function (err) {
      if (err) return res.status(500).json({ message: err.message });
      if (this.changes === 0) {
        return res
          .status(404)
          .json({ message: 'User not found or is a master user.' });
      }
      logger.info('User role updated', {
        admin: req.user.username,
        targetUserId,
        newRole: role,
      });
      res.json({ message: 'User role updated successfully' });
    }
  );
});

// Get a user's template permissions
router.get('/:id/permissions', protect, (req, res) => {
  db.all(
    'SELECT template_id FROM user_template_permissions WHERE user_id = ?',
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows.map((r) => r.template_id));
    }
  );
});

// Update a user's template permissions using a transaction
router.put('/:id/permissions', protect, (req, res) => {
  const userId = req.params.id;
  const { templateIds } = req.body;

  if (!Array.isArray(templateIds)) {
    return res.status(400).json({ message: 'templateIds must be an array.' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run(
      'DELETE FROM user_template_permissions WHERE user_id = ?',
      [userId],
      (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res
            .status(500)
            .json({ message: 'Failed to clear old permissions.' });
        }

        if (templateIds.length > 0) {
          const stmt = db.prepare(
            'INSERT INTO user_template_permissions (user_id, template_id) VALUES (?, ?)'
          );
          templateIds.forEach((templateId) => {
            stmt.run(userId, templateId);
          });
          stmt.finalize((err) => {
            if (err) {
              db.run('ROLLBACK');
              logger.error(
                'Failed to insert new permissions during transaction',
                { admin: req.user.username, userId, error: err.message }
              );
              return res
                .status(500)
                .json({ message: 'Failed to insert new permissions.' });
            }
            db.run('COMMIT');
            logger.info('User permissions updated', {
              admin: req.user.username,
              userId,
              templateIds,
            });
            res.json({ message: 'Permissions updated successfully' });
          });
        } else {
          db.run('COMMIT');
          logger.info('All permissions cleared for user', {
            admin: req.user.username,
            userId,
          });
          res.json({
            message: 'Permissions updated successfully (all removed)',
          });
        }
      }
    );
  });
});

module.exports = router;
