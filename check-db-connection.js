// 데이터베이스 연결 테스트 스크립트
// 사용법: node check-db-connection.js

require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('❌ POSTGRES_URL 환경 변수가 설정되지 않았습니다.');
  console.log('\nVercel 대시보드에서 환경 변수를 확인하세요:');
  console.log('1. Settings → Environment Variables');
  console.log('2. POSTGRES_URL 확인');
  process.exit(1);
}

console.log('✅ POSTGRES_URL 환경 변수 발견');
console.log('연결 문자열:', connectionString.replace(/:[^:@]+@/, ':****@')); // 비밀번호 마스킹

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function testConnection() {
  try {
    console.log('\n🔄 데이터베이스 연결 시도 중...');
    const result = await pool.query('SELECT NOW() as current_time, version() as version');
    console.log('✅ 데이터베이스 연결 성공!');
    console.log('현재 시간:', result.rows[0].current_time);
    console.log('PostgreSQL 버전:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error.message);
    console.error('\n에러 상세:', error);
    await pool.end();
    process.exit(1);
  }
}

testConnection();

