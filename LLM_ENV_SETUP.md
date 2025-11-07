# LLM API 키 환경 변수 설정 가이드

## Vercel에서 환경 변수 설정 방법

### 1. Vercel 대시보드 접속
1. https://vercel.com/dashboard 접속
2. 프로젝트 선택 (`ai-workflow-engine`)

### 2. 환경 변수 추가
1. **Settings** → **Environment Variables** 클릭
2. **Add New** 버튼 클릭
3. 다음 환경 변수들을 추가:

#### 필수 환경 변수

**OpenAI API Key**
```
Name: OPENAI_API_KEY
Value: [OpenAI API 키]
Environments: Production, Preview, Development 모두 선택
```

**Google API Key**
```
Name: GOOGLE_API_KEY
Value: [Google API 키]
Environments: Production, Preview, Development 모두 선택
```

**Anthropic API Key**
```
Name: ANTHROPIC_API_KEY
Value: [Anthropic API 키]
Environments: Production, Preview, Development 모두 선택
```

### 3. API 키 발급 방법

#### OpenAI API Key
1. https://platform.openai.com/api-keys 접속
2. 로그인 후 "Create new secret key" 클릭
3. 키 이름 입력 후 생성
4. 생성된 키를 복사 (한 번만 표시됨)

#### Google API Key
1. https://console.cloud.google.com/apis/credentials 접속
2. "Create Credentials" → "API Key" 선택
3. 생성된 키를 복사
4. API 제한 설정 (Generative Language API 활성화 필요)

#### Anthropic API Key
1. https://console.anthropic.com/ 접속
2. 로그인 후 "API Keys" 메뉴
3. "Create Key" 클릭
4. 키 이름 입력 후 생성
5. 생성된 키를 복사

### 4. 환경 변수 우선순위

현재 시스템은 다음 우선순위로 API 키를 사용합니다:

1. **환경 변수** (최우선)
   - `OPENAI_API_KEY`
   - `GOOGLE_API_KEY`
   - `ANTHROPIC_API_KEY`

2. **데이터베이스** (환경 변수가 없을 때)
   - `settings` 테이블의 `openai_api_key`, `google_api_key`, `anthropic_api_key`

### 5. 배포 후 확인

환경 변수를 설정한 후:
1. 새로운 배포가 자동으로 시작됩니다
2. 배포 완료 후 API 테스트
3. 관리자 페이지에서 API 키 상태 확인

### 6. 보안 주의사항

- ✅ 환경 변수는 Vercel 대시보드에서만 관리
- ✅ API 키는 절대 코드에 하드코딩하지 않음
- ✅ Git 저장소에 API 키 커밋하지 않음
- ✅ 환경 변수는 Production, Preview, Development 모두 설정 권장

### 7. 문제 해결

#### API 키가 작동하지 않는 경우
1. 환경 변수가 올바르게 설정되었는지 확인
2. 배포가 완료되었는지 확인
3. Runtime Logs에서 에러 확인
4. API 키가 유효한지 확인 (각 서비스 대시보드에서)

#### 환경 변수 vs 데이터베이스
- 환경 변수를 설정하면 데이터베이스의 키보다 우선 사용됩니다
- 환경 변수를 제거하면 데이터베이스의 키를 사용합니다
- 둘 다 설정되어 있으면 환경 변수가 우선입니다

