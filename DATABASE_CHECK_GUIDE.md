# 데이터베이스 저장 상태 확인 가이드

## 확인 방법

### 방법 1: Vercel Runtime Logs 확인 (가장 쉬운 방법)

1. **Vercel 대시보드 접속**
   - https://vercel.com/dashboard
   - 프로젝트 선택 (`ai-workflow-engine`)

2. **Runtime Logs 확인**
   - Deployments → 최신 배포 클릭
   - Runtime Logs 탭 클릭
   - 데이터베이스 관련 로그 확인:
     - `Tables checked/created successfully in PostgreSQL.`
     - `Master account created successfully.`
     - `API keys loaded from DB and cached.`

3. **API 요청 로그 확인**
   - 성공적인 요청: `statusCode: 200`, `statusCode: 201`
   - 실패한 요청: `statusCode: 500`, 에러 메시지 확인

### 방법 2: API 엔드포인트를 통한 확인

#### 사용자 목록 확인
```bash
# 마스터 계정으로 로그인 후
curl -X GET https://ai-workflow-engine-mu.vercel.app/api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 워크플로우 목록 확인
```bash
curl -X GET https://ai-workflow-engine-mu.vercel.app/api/workflows \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 템플릿 목록 확인
```bash
curl -X GET https://ai-workflow-engine-mu.vercel.app/api/templates \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 에러 로그 확인
```bash
curl -X GET https://ai-workflow-engine-mu.vercel.app/api/logs/error \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 방법 3: Neon/Supabase 대시보드에서 직접 확인

#### Neon 사용 시:
1. **Neon 대시보드 접속**
   - https://console.neon.tech
   - 프로젝트 선택

2. **SQL Editor 사용**
   ```sql
   -- 사용자 확인
   SELECT id, username, role, created_at FROM users;
   
   -- 워크플로우 확인
   SELECT id, user_id, title, created_at FROM workflows;
   
   -- 템플릿 확인
   SELECT id, name, created_by FROM templates;
   
   -- 에러 로그 확인
   SELECT id, username, error_message, timestamp 
   FROM error_logs 
   ORDER BY timestamp DESC 
   LIMIT 10;
   
   -- LLM 로그 확인
   SELECT id, username, provider, model_id, is_success, timestamp 
   FROM llm_logs 
   ORDER BY timestamp DESC 
   LIMIT 10;
   ```

#### Supabase 사용 시:
1. **Supabase 대시보드 접속**
   - https://app.supabase.com
   - 프로젝트 선택

2. **Table Editor 사용**
   - 왼쪽 메뉴에서 "Table Editor" 클릭
   - 각 테이블 확인:
     - `users`
     - `workflows`
     - `templates`
     - `settings`
     - `error_logs`
     - `llm_logs`

### 방법 4: 로컬 스크립트로 확인

1. **환경 변수 설정**
   ```bash
   # .env 파일에 POSTGRES_URL 설정
   POSTGRES_URL=postgresql://...
   ```

2. **확인 스크립트 실행**
   ```bash
   node check-database.js
   ```

### 방법 5: 관리자 페이지에서 확인

1. **웹 애플리케이션 접속**
   - https://ai-workflow-engine-mu.vercel.app

2. **마스터 계정으로 로그인**
   - Username: `master`
   - Password: `MASTER_PASSWORD` 환경 변수에 설정한 값

3. **관리자 페이지 확인**
   - 사용자 목록
   - 템플릿 목록
   - 에러 로그
   - LLM 로그

## 확인할 주요 데이터

### 1. 사용자 데이터
- 마스터 계정이 생성되었는지
- 새로 가입한 사용자가 있는지
- 사용자 역할이 올바른지

### 2. 워크플로우 데이터
- 워크플로우가 생성되었는지
- 워크플로우가 업데이트되었는지
- 북마크가 저장되었는지

### 3. 템플릿 데이터
- 샘플 템플릿이 생성되었는지
- 템플릿이 올바르게 저장되었는지

### 4. 로그 데이터
- 에러 로그가 기록되고 있는지
- LLM 로그가 기록되고 있는지

## 문제 해결

### 데이터가 저장되지 않는 경우

1. **데이터베이스 연결 확인**
   - Runtime Logs에서 연결 에러 확인
   - `POSTGRES_URL` 환경 변수 확인

2. **API 요청 확인**
   - Network 탭에서 요청 상태 확인
   - 에러 메시지 확인

3. **데이터베이스 권한 확인**
   - Neon/Supabase에서 테이블 권한 확인
   - 사용자 권한 확인

### 데이터가 중복 저장되는 경우

1. **트랜잭션 확인**
   - 중복 방지 로직 확인
   - UNIQUE 제약 조건 확인

2. **API 호출 확인**
   - 중복 요청이 발생하는지 확인
   - 프론트엔드에서 중복 호출 방지

## 빠른 확인 체크리스트

- [ ] 마스터 계정이 생성되었는지 확인
- [ ] 워크플로우가 저장되는지 확인
- [ ] 템플릿이 저장되는지 확인
- [ ] 에러 로그가 기록되는지 확인
- [ ] LLM 로그가 기록되는지 확인
- [ ] API 키가 저장되는지 확인

