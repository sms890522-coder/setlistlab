# 팀 녹음실 R2 저장소 설정

SetlistLab 팀 녹음실은 실제 오디오 파일을 Supabase Storage에 저장하지 않습니다. Supabase는 Auth, DB, RLS, 녹음 메타데이터만 담당하고, 녹음 파일은 Cloudflare R2 private bucket에 저장합니다.

## 왜 R2를 쓰나요?

- 녹음 파일은 용량과 bandwidth가 커질 수 있습니다.
- R2는 S3 compatible API와 presigned URL을 제공하므로 브라우저가 파일을 직접 업로드할 수 있습니다.
- 서버와 클라이언트에는 R2 secret을 노출하지 않고, 짧은 만료 시간의 업로드/재생 URL만 발급합니다.

## 환경변수

Vercel과 로컬 `.env.local`에 아래 값을 설정합니다.

```bash
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_RECORDINGS=setlistlab-recordings
R2_PUBLIC_BASE_URL=
R2_REGION=auto
```

주의:

- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`는 서버 전용입니다.
- `NEXT_PUBLIC_` 접두사를 붙이지 마세요.
- 기본 구조는 private bucket + presigned URL입니다.
- `R2_PUBLIC_BASE_URL`은 public bucket을 쓰지 않는다면 비워둘 수 있습니다.

## R2 bucket 만들기

1. Cloudflare Dashboard에서 R2로 이동합니다.
2. `setlistlab-recordings` 같은 이름으로 bucket을 만듭니다.
3. bucket은 private으로 유지합니다.
4. R2 API Token을 만들고 `Object Read & Write` 권한을 부여합니다.
5. Account ID, Access Key ID, Secret Access Key를 환경변수에 넣습니다.

## CORS 설정

R2 bucket의 CORS에 아래 예시를 넣습니다.

```json
[
  {
    "AllowedOrigins": [
      "https://setlistlab.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

운영 환경에서는 필요 없으면 `http://localhost:3000`을 제거하세요. Vercel preview 배포에서 테스트하려면 해당 preview URL도 `AllowedOrigins`에 추가해야 합니다.

## 업로드 흐름

1. 클라이언트가 녹음 Blob을 만듭니다.
2. `/api/recordings/presign-upload`로 업로드 URL을 요청합니다.
3. 서버는 Supabase Auth 토큰을 검증하고 팀 승인 멤버인지 확인합니다.
4. 서버가 `teams/{teamId}/sessions/{sessionId}/users/{userId}/{trackId}.webm` 형식의 object key를 생성합니다.
5. 서버가 `team_recording_tracks` row를 `uploading` 상태로 만들고 R2 presigned PUT URL을 반환합니다.
6. 브라우저가 R2로 직접 PUT 업로드합니다.
7. 업로드 후 `/api/recordings/complete-upload`을 호출합니다.
8. 서버가 R2 `HeadObject`로 파일을 확인하고 DB row를 `active`로 바꿉니다.

## 재생 흐름

1. 클라이언트가 `/api/recordings/presign-read`에 `trackId`를 보냅니다.
2. 서버가 사용자의 팀 권한을 확인합니다.
3. R2 presigned GET URL을 15분 만료로 발급합니다.
4. 클라이언트는 이 URL을 `<audio>`의 `src`로 사용합니다.

## 제한

- MVP 업로드 최대 크기: 50MB
- 허용 MIME:
  - `audio/webm`
  - `audio/webm;codecs=opus`
  - `audio/mp4`
  - `audio/aac`
  - `audio/mpeg`
  - `audio/wav`

## 보안 주의사항

- R2 secret은 클라이언트에 절대 노출하지 않습니다.
- object key는 서버가 생성합니다.
- 클라이언트가 임의 object key를 지정하지 못하게 합니다.
- presigned URL 만료 시간은 짧게 유지합니다.
- pending/rejected/removed 팀원은 업로드/재생 URL을 받을 수 없습니다.
- 다른 팀 사용자는 녹음 메타데이터와 read URL에 접근할 수 없습니다.

## 로컬 개발

1. `.env.local`에 Supabase와 R2 환경변수를 넣습니다.
2. R2 CORS에 `http://localhost:3000`을 추가합니다.
3. 개발 서버를 실행합니다.

```bash
npm run dev
```

4. 실험실을 켠 계정으로 팀 가이드 트랙에서 `팀 녹음실 열기`를 누릅니다.

R2 설정이 누락되면 녹음 화면은 열릴 수 있지만 저장 단계에서 “녹음 파일 저장소 설정이 준비되지 않았습니다.” 오류가 표시됩니다.
