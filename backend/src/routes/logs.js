const express = require('express');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const { protect, masterOnly } = require('../middleware/authMiddleware');
const router = express.Router();

// 프론트엔드에서 발생한 오류를 받아 DB에 저장하는 API
router.post('/error', protect, (req, res) => {
  const { userId, username } = req.user;
  const {
    action_type: actionType,
    workflow_id: workflowId,
    step_index: stepIndex,
    error_message: errorMessage,
    context,
  } = req.body;

  const sql =
    'INSERT INTO error_logs (user_id, username, action_type, workflow_id, step_index, error_message, context) VALUES (?, ?, ?, ?, ?, ?, ?)';
  const params = [
    userId,
    username,
    actionType,
    workflowId,
    stepIndex,
    errorMessage,
    JSON.stringify(context),
  ];

  db.run(sql, params, function (err) {
    if (err) {
      logger.error('Failed to log error to DB', {
        error: err.message,
        user: username,
      });
      return res.status(500).json({ message: 'Error logging failed.' });
    }
    res.status(201).json({ message: 'Error logged successfully.' });
  });
});

// --- IMPROVEMENT ---
// 페이지네이션을 적용하여 대용량 로그 조회 시 성능 저하를 방지합니다.
router.get('/errors', protect, masterOnly, async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = (page - 1) * limit;

  try {
    const countSql = 'SELECT COUNT(*) as total FROM error_logs';
    const dataSql =
      'SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?';

    const totalPromise = new Promise((resolve, reject) => {
      db.get(countSql, [], (err, row) =>
        err ? reject(err) : resolve(row.total)
      );
    });

    const rowsPromise = new Promise((resolve, reject) => {
      db.all(dataSql, [limit, offset], (err, rows) =>
        err ? reject(err) : resolve(rows)
      );
    });

    const [total, rows] = await Promise.all([totalPromise, rowsPromise]);

    res.json({
      logs: rows,
      total,
      page,
      limit,
    });
  } catch (err) {
    logger.error('Failed to fetch error logs from DB', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch error logs.' });
  }
});

// --- IMPROVEMENT ---
// 페이지네이션을 적용하여 대용량 로그 조회 시 성능 저하를 방지합니다.
router.get('/llm', protect, masterOnly, async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = (page - 1) * limit;

  try {
    const countSql = 'SELECT COUNT(*) as total FROM llm_logs';
    const dataSql =
      'SELECT id, timestamp, username, template_name, step_index, provider, model_id, is_success FROM llm_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?';

    const totalPromise = new Promise((resolve, reject) => {
      db.get(countSql, [], (err, row) =>
        err ? reject(err) : resolve(row.total)
      );
    });

    const rowsPromise = new Promise((resolve, reject) => {
      db.all(dataSql, [limit, offset], (err, rows) =>
        err ? reject(err) : resolve(rows)
      );
    });

    const [total, rows] = await Promise.all([totalPromise, rowsPromise]);

    res.json({
      logs: rows,
      total,
      page,
      limit,
    });
  } catch (err) {
    logger.error('Failed to fetch LLM logs from DB', { error: err.message });
    return res.status(500).json({ message: 'Failed to fetch LLM logs.' });
  }
});

router.get('/llm/:id', protect, masterOnly, (req, res) => {
  const sql = `
        SELECT provider, model_id, request_payload, response_payload, error_message, is_success 
        FROM llm_logs 
        WHERE id = ?`;

  db.get(sql, [req.params.id], (err, row) => {
    if (err) {
      logger.error('Failed to fetch LLM log detail from DB', {
        error: err.message,
        logId: req.params.id,
      });
      return res
        .status(500)
        .json({ message: 'Failed to fetch LLM log detail.' });
    }
    if (!row) {
      return res.status(404).json({ message: 'Log not found.' });
    }

    try {
      res.json({
        provider: row.provider,
        model_id: row.model_id,
        request_payload: JSON.parse(row.request_payload),
        response_payload: row.response_payload,
        error_message: row.error_message,
        is_success: row.is_success,
      });
    } catch (e) {
      res.status(500).json({ message: 'Failed to parse log payload.' });
    }
  });
});

module.exports = router;
