const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../workflow.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    logger.error('Database connection error', { error: err.message });
    process.exit(1);
  } else {
    logger.info('Connected to the SQLite database.');
  }
});

const initDb = () => {
  db.serialize(() => {
    const tableCreationQueries = [
      `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, config TEXT NOT NULL, created_by INTEGER, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL)`,
      `CREATE TABLE IF NOT EXISTS workflows (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                user_id INTEGER NOT NULL, 
                title TEXT, 
                template_snapshot TEXT NOT NULL, 
                execution_context TEXT NOT NULL, 
                is_bookmarked INTEGER DEFAULT 0,
                bookmark_title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
      `CREATE TABLE IF NOT EXISTS user_template_permissions (user_id INTEGER NOT NULL, template_id INTEGER NOT NULL, PRIMARY KEY (user_id, template_id), FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE, FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE CASCADE)`,
      `CREATE TABLE IF NOT EXISTS error_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, username TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, action_type TEXT, workflow_id INTEGER, step_index INTEGER, error_message TEXT, context TEXT, FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL)`,
      `CREATE TABLE IF NOT EXISTS llm_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, user_id INTEGER, username TEXT, workflow_id INTEGER, template_name TEXT, step_index INTEGER, provider TEXT, model_id TEXT, request_payload TEXT, response_payload TEXT, is_success INTEGER, error_message TEXT, FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL)`,
    ];

    tableCreationQueries.forEach((query) =>
      db.run(query, (err) => {
        if (err)
          logger.error('Table creation failed', { query, error: err.message });
      })
    );

    const masterUsername = 'master';
    const masterPassword = process.env.MASTER_PASSWORD || 'masterpassword';
    db.get("SELECT * FROM users WHERE role = 'master'", (err, row) => {
      if (err)
        return logger.error('DB Error checking for master account:', {
          error: err.message,
        });
      if (!row) {
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(masterPassword, salt);
        db.run(
          'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
          [masterUsername, passwordHash, 'master'],
          (err) => {
            if (err)
              return logger.error('Failed to create master account', {
                error: err.message,
              });
            if (process.env.NODE_ENV !== 'production') {
              logger.info(
                `Master account created. USER: ${masterUsername}. Please use the configured MASTER_PASSWORD to log in.`
              );
            } else {
              logger.info('Master account created successfully.');
            }
          }
        );
      }
    });

    db.get('SELECT COUNT(*) as count FROM templates', (err, row) => {
      if (err)
        return logger.error('DB Error checking for templates:', {
          error: err.message,
        });
      if (row.count === 0) {
        logger.info('No templates found. Creating sample templates...');
        // --- ARCHITECTURE REWORK ---
        // 하이브리드 메모리 방식에 맞춰 샘플 템플릿의 프롬프트를 단순화합니다.
        // 더 이상 [이전 단계 결과] 플레이스홀더를 사용하지 않습니다.
        const sampleTemplates = [
          {
            name: '연속 대화형 시장 조사 보고서',
            config: {
              model: 'OpenAI__gpt-4o',
              globalInstruction:
                '당신은 뛰어난 시장 분석가입니다. 사용자와 대화하며 단계별로 시장 조사 보고서를 완성해 나갑니다. 이전 대화의 맥락을 완벽하게 파악하여 답변해주세요.',
              steps: [
                {
                  name: '1. 조사 대상 및 범위 설정',
                  instruction:
                    '조사하고 싶은 시장이나 제품에 대해 알려주세요. 보고서의 주요 목적은 무엇인가요?',
                  prompt:
                    '사용자가 요청한 조사 대상과 목적을 바탕으로, 보고서의 목차와 서론을 작성해주세요. [현재 단계 사용자 입력]',
                },
                {
                  name: '2. 데이터 분석 및 시사점 도출',
                  instruction:
                    '관련 뉴스 기사, 통계 데이터, 또는 분석하고 싶은 자료를 입력해주세요.',
                  prompt:
                    '제공된 자료를 분석하고, 이전 대화에서 논의한 보고서의 목적에 맞춰 핵심적인 시사점을 3가지 이상 도출해주세요. [현재 단계 사용자 입력]',
                },
                {
                  name: '3. 최종 결론 및 전략 제안',
                  instruction:
                    '지금까지의 분석 내용을 바탕으로 어떤 결론을 내리고 싶으신가요? 또는 어떤 전략을 제안하고 싶으신가요?',
                  prompt:
                    '지금까지의 모든 대화 내용을 종합하여, 사용자의 마지막 요청에 맞춰 보고서의 최종 결론 및 전략 제안 부분을 작성해주세요. [현재 단계 사용자 입력]',
                },
              ],
            },
          },
        ];

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          const stmt = db.prepare(
            'INSERT INTO templates (name, config, created_by) VALUES (?, ?, ?)'
          );
          sampleTemplates.forEach((t) => {
            stmt.run(t.name, JSON.stringify(t.config), 1);
          });
          stmt.finalize((err) => {
            if (err) {
              db.run('ROLLBACK');
              logger.error('Failed to create sample templates', {
                error: err.message,
              });
            } else {
              db.run('COMMIT');
              logger.info('Sample templates created successfully.');
            }
          });
        });
      }
    });
  });
};

const closeDb = () => {
  db.close((err) => {
    if (err)
      return logger.error('Error closing the database', { error: err.message });
    logger.info('Database connection closed.');
  });
};

module.exports = { db, initDb, closeDb };
