# Vercel 배포 가이드

## 환경 변수 설정

### 필수 환경 변수

1. **JWT_SECRET**
   - 설명: JWT 토큰 서명에 사용되는 비밀 키
   - 예시 값: `your-super-secret-jwt-key-here-12345`
   - 생성 방법: 
     ```bash
     # Node.js에서 생성
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

2. **POSTGRES_URL**
   - 설명: PostgreSQL 데이터베이스 연결 문자열
   - Vercel Postgres 사용 시:
     - Vercel 대시보드 → Storage → Create Database → Postgres
     - 자동으로 환경 변수에 추가됨
   - 외부 PostgreSQL 사용 시:
     - 형식: `postgresql://user:password@host:port/database?sslmode=require`
     - 예시: `postgresql://user:pass@db.example.com:5432/mydb?sslmode=require`

3. **MASTER_PASSWORD** (선택)
   - 설명: 마스터 계정 비밀번호
   - 기본값: `masterpassword` (보안상 변경 권장)
   - 예시 값: `your-secure-master-password-123`

## 배포 설정

### vercel.json 설정 확인

현재 설정:
- Frontend: Vite 빌드 → `frontend/dist`
- Backend: Express 앱 → 서버리스 함수로 변환
- 라우팅: `/api/*` → Backend, `/*` → Frontend

### 배포 후 확인 사항

1. **Frontend 접속 확인**
   - 배포된 URL로 접속
   - 로그인/회원가입 페이지가 표시되는지 확인

2. **API 엔드포인트 확인**
   - `/api/auth/login` - 로그인 API
   - `/api/auth/register` - 회원가입 API
   - 기타 API 엔드포인트 동작 확인

3. **데이터베이스 연결 확인**
   - 첫 번째 요청 시 데이터베이스 초기화가 자동으로 실행됨
   - 마스터 계정이 자동으로 생성됨 (username: `master`)

## 문제 해결

### 빌드 실패
- Frontend 빌드 실패: `frontend/package.json` 확인
- Backend 빌드 실패: `backend/package.json` 확인
- 로그 확인: Vercel 대시보드 → Deployments → 해당 배포 → Build Logs

### 런타임 에러
- 환경 변수 확인: Vercel 대시보드 → Settings → Environment Variables
- 데이터베이스 연결 확인: `POSTGRES_URL` 확인
- 로그 확인: Vercel 대시보드 → Deployments → 해당 배포 → Runtime Logs

### API 500 에러
- 데이터베이스 초기화 실패 가능성
- `POSTGRES_URL` 확인
- Vercel Postgres 사용 시 데이터베이스가 활성화되어 있는지 확인

## 배포 후 테스트

1. 회원가입 테스트
2. 로그인 테스트
3. 워크플로우 생성 테스트
4. 관리자 기능 테스트 (마스터 계정)

