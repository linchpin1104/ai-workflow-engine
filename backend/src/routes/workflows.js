const express = require('express');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

const parseJsonFields = (row) => ({
  ...row,
  template_snapshot: JSON.parse(row.template_snapshot),
  execution_context: JSON.parse(row.execution_context),
});

router.get('/bookmarked', protect, (req, res) => {
  const sql = `
        SELECT id, bookmark_title, updated_at 
        FROM workflows 
        WHERE user_id = ? AND is_bookmarked = 1 
        ORDER BY updated_at DESC
    `;
  db.all(sql, [req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
});

router.get('/', protect, (req, res) => {
  db.all(
    'SELECT id, title, updated_at FROM workflows WHERE user_id = ? ORDER BY updated_at DESC',
    [req.user.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows);
    }
  );
});

router.get('/:id', protect, (req, res) => {
  db.get(
    'SELECT * FROM workflows WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.userId],
    (err, row) => {
      if (err) return res.status(500).json({ message: err.message });
      if (!row)
        return res
          .status(404)
          .json({ message: 'Workflow not found or access denied' });
      res.json(parseJsonFields(row));
    }
  );
});

// --- ARCHITECTURE REWORK ---
// execution_context에 대화 요약(summary)을 저장할 필드를 추가합니다.
router.post('/', protect, (req, res) => {
  const { title, template_snapshot: templateSnapshot } = req.body;

  const initialContext = {
    currentStepIndex: 0,
    summary: '', // 장기 기억을 위한 요약본 저장 필드
    results: templateSnapshot.config.steps.map(() => ({
      content: '',
      mode: 'view',
      status: 'pending',
      userInput: '',
    })),
  };

  db.run(
    'INSERT INTO workflows (user_id, title, template_snapshot, execution_context) VALUES (?, ?, ?, ?)',
    [
      req.user.userId,
      title,
      JSON.stringify(templateSnapshot),
      JSON.stringify(initialContext),
    ],
    function (err) {
      if (err) {
        logger.error('Workflow creation failed', {
          user: req.user.username,
          error: err.message,
        });
        return res.status(500).json({ message: err.message });
      }
      logger.info('Workflow created', {
        user: req.user.username,
        workflowId: this.lastID,
        templateName: templateSnapshot.name,
      });
      res
        .status(201)
        .json({ id: this.lastID, execution_context: initialContext });
    }
  );
});

router.put('/:id', protect, (req, res) => {
  const { execution_context: executionContext } = req.body;
  db.run(
    'UPDATE workflows SET execution_context = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [JSON.stringify(executionContext), req.params.id, req.user.userId],
    function (err) {
      if (err) return res.status(500).json({ message: err.message });
      if (this.changes === 0)
        return res
          .status(404)
          .json({ message: 'Workflow not found or access denied' });
      res.json({ message: 'Workflow updated successfully' });
    }
  );
});

router.put('/:id/bookmark', protect, (req, res) => {
  const { bookmark_title: bookmarkTitle } = req.body;
  if (!bookmarkTitle) {
    return res.status(400).json({ message: 'Bookmark title is required' });
  }
  const sql = `
        UPDATE workflows 
        SET is_bookmarked = 1, bookmark_title = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND user_id = ?
    `;
  db.run(sql, [bookmarkTitle, req.params.id, req.user.userId], function (err) {
    if (err) return res.status(500).json({ message: err.message });
    if (this.changes === 0)
      return res
        .status(404)
        .json({ message: 'Workflow not found or access denied' });
    logger.info('Workflow bookmarked', {
      user: req.user.username,
      workflowId: req.params.id,
      title: bookmarkTitle,
    });
    res.json({ message: 'Workflow bookmarked successfully' });
  });
});

router.delete('/:id/bookmark', protect, (req, res) => {
  const sql = `
        UPDATE workflows 
        SET is_bookmarked = 0, bookmark_title = NULL, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND user_id = ?
    `;
  db.run(sql, [req.params.id, req.user.userId], function (err) {
    if (err) return res.status(500).json({ message: err.message });
    if (this.changes === 0)
      return res
        .status(404)
        .json({ message: 'Workflow not found or access denied' });
    logger.info('Workflow unbookmarked', {
      user: req.user.username,
      workflowId: req.params.id,
    });
    res.json({ message: 'Bookmark removed successfully' });
  });
});

module.exports = router;
