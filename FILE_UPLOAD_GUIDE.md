# 파일 업로드 크기 제한 가이드

## 현재 설정

- **Express body parser limit**: 10MB
- **Vercel 서버리스 함수 제한**: 이론적으로 4.5MB이지만, 실제로는 더 큰 요청도 처리 가능

## 파일 크기 제한

### 현재 지원 크기
- **JSON 요청 본문**: 최대 10MB
- **Base64 인코딩 파일**: 약 7-8MB (Base64는 원본의 약 133% 크기)

### 실제 처리 가능한 파일 크기
- **PDF 파일**: 약 7-8MB까지 안전하게 처리 가능
- **텍스트 파일**: 약 10MB까지 처리 가능
- **이미지 파일**: 약 7-8MB까지 처리 가능

## 더 큰 파일이 필요한 경우

### 옵션 1: 청크 업로드 (권장)
파일을 작은 청크로 나누어 여러 요청으로 전송:

```javascript
// 프론트엔드 예시
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB 청크
const file = event.target.files[0];
const chunks = Math.ceil(file.size / CHUNK_SIZE);

for (let i = 0; i < chunks; i++) {
  const start = i * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, file.size);
  const chunk = file.slice(start, end);
  
  await fetch('/api/files/upload-chunk', {
    method: 'POST',
    body: JSON.stringify({
      chunkIndex: i,
      totalChunks: chunks,
      chunk: await chunkToBase64(chunk),
    }),
  });
}
```

### 옵션 2: 클라우드 스토리지 사용
파일을 직접 클라우드 스토리지에 업로드:

- **Vercel Blob Storage**: Vercel의 네이티브 스토리지
- **AWS S3**: 대용량 파일 처리에 적합
- **Cloudinary**: 이미지/비디오 최적화 포함

### 옵션 3: 스트리밍 업로드
파일을 스트림으로 전송하여 메모리 효율적으로 처리

### 옵션 4: Limit 더 늘리기
필요시 Express limit을 더 늘릴 수 있습니다:

```javascript
app.use(express.json({ limit: '50mb' })); // 50MB까지
```

⚠️ **주의**: Vercel의 실제 제한을 초과하면 에러가 발생할 수 있습니다.

## 제한 늘리기

현재 10MB로 설정되어 있지만, 더 큰 파일이 필요하면:

1. **20MB로 늘리기**:
   ```javascript
   app.use(express.json({ limit: '20mb' }));
   ```

2. **50MB로 늘리기**:
   ```javascript
   app.use(express.json({ limit: '50mb' }));
   ```

3. **무제한 (권장하지 않음)**:
   ```javascript
   app.use(express.json({ limit: Infinity }));
   ```

## 권장 사항

1. **10MB 이하**: 현재 설정으로 충분
2. **10-20MB**: Limit을 20MB로 늘리기
3. **20MB 이상**: 청크 업로드 또는 클라우드 스토리지 사용

## 문제 해결

### "Request entity too large" 에러 발생 시

1. **파일 크기 확인**: 클라이언트에서 파일 크기 체크
2. **압축**: 파일을 압축하여 크기 줄이기
3. **청크 업로드**: 파일을 나누어 전송
4. **클라우드 스토리지**: 직접 업로드 방식 사용

