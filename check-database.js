// 데이터베이스 저장 상태 확인 스크립트
// 사용법: node check-database.js

require('dotenv').config();
const { db } = require('./backend/src/config/database');

async function checkDatabase() {
  try {
    console.log('🔍 데이터베이스 저장 상태 확인 중...\n');

    // 1. 사용자 확인
    console.log('1️⃣ 사용자 테이블 확인:');
    const users = await db.query('SELECT id, username, role, created_at FROM users ORDER BY id');
    console.log(`   총 ${users.rows.length}명의 사용자`);
    users.rows.forEach((user) => {
      console.log(`   - ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);
    });
    console.log('');

    // 2. 워크플로우 확인
    console.log('2️⃣ 워크플로우 테이블 확인:');
    const workflows = await db.query(
      'SELECT id, user_id, title, is_bookmarked, created_at FROM workflows ORDER BY id'
    );
    console.log(`   총 ${workflows.rows.length}개의 워크플로우`);
    workflows.rows.forEach((workflow) => {
      console.log(
        `   - ID: ${workflow.id}, User ID: ${workflow.user_id}, Title: ${workflow.title || '(제목 없음)'}, Bookmarked: ${workflow.is_bookmarked}`
      );
    });
    console.log('');

    // 3. 템플릿 확인
    console.log('3️⃣ 템플릿 테이블 확인:');
    const templates = await db.query('SELECT id, name, created_by FROM templates ORDER BY id');
    console.log(`   총 ${templates.rows.length}개의 템플릿`);
    templates.rows.forEach((template) => {
      console.log(`   - ID: ${template.id}, Name: ${template.name}, Created By: ${template.created_by}`);
    });
    console.log('');

    // 4. 설정 확인 (API 키는 마스킹)
    console.log('4️⃣ 설정 테이블 확인:');
    const settings = await db.query('SELECT key FROM settings ORDER BY key');
    console.log(`   총 ${settings.rows.length}개의 설정`);
    settings.rows.forEach((setting) => {
      console.log(`   - Key: ${setting.key}`);
    });
    console.log('');

    // 5. 에러 로그 확인
    console.log('5️⃣ 에러 로그 확인:');
    const errorLogs = await db.query(
      'SELECT id, username, action_type, error_message, timestamp FROM error_logs ORDER BY timestamp DESC LIMIT 5'
    );
    console.log(`   최근 ${errorLogs.rows.length}개의 에러 로그`);
    errorLogs.rows.forEach((log) => {
      console.log(
        `   - ID: ${log.id}, User: ${log.username}, Action: ${log.action_type}, Error: ${log.error_message?.substring(0, 50)}...`
      );
    });
    console.log('');

    // 6. LLM 로그 확인
    console.log('6️⃣ LLM 로그 확인:');
    const llmLogs = await db.query(
      'SELECT id, username, provider, model_id, is_success, timestamp FROM llm_logs ORDER BY timestamp DESC LIMIT 5'
    );
    console.log(`   최근 ${llmLogs.rows.length}개의 LLM 로그`);
    llmLogs.rows.forEach((log) => {
      console.log(
        `   - ID: ${log.id}, User: ${log.username}, Provider: ${log.provider}, Model: ${log.model_id}, Success: ${log.is_success}`
      );
    });
    console.log('');

    console.log('✅ 데이터베이스 확인 완료!');
    process.exit(0);
  } catch (error) {
    console.error('❌ 데이터베이스 확인 실패:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkDatabase();

