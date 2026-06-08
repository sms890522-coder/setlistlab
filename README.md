# setlistlab

찬양팀을 위한 유튜브 구간반복 콘티 공유 도구입니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 주요 기능

- 콘티 생성, 수정, 목록 보기
- 곡별 YouTube 링크 등록
- YouTube IFrame API 기반 재생
- 재생속도 조절, 5초 이동, 구간반복
- 재생 중 실시간 송폼 입력
- 파트별 메모와 강조사항 관리
- localStorage 자동 저장
- 게스트 localStorage 임시 저장
- Supabase Auth 로그인 저장
- Supabase 기반 콘티, 곡 보관함, 팀원 관리
- 공개 공유 링크 `/s/[shareSlug]`
- 같은 교회/찬양팀 기준 연습중인 팀원 표시
- 같은 교회/찬양팀 기준 접속중 팀 채팅
- JSON 가져오기

## Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. `supabase/schema.sql` 내용을 Supabase SQL Editor에서 실행합니다.
3. `.env.local` 또는 Vercel 환경변수에 아래 값을 설정합니다.

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
```

4. Supabase Auth에서 이메일 로그인 또는 구글 OAuth를 켭니다.
5. Vercel에서 다시 배포합니다.

환경변수 예시는 `.env.local.example`에도 들어 있습니다.

## 로그인 저장 구조

- 비로그인 사용자는 기존처럼 이 브라우저의 `localStorage`에 임시 저장됩니다.
- 로그인 사용자는 Supabase의 `setlists`, `saved_songs`, `team_members`, `setlist_assignments` 테이블에 저장됩니다.
- 로그인 후 콘티 목록에서 브라우저에 남아 있는 임시 콘티를 계정 저장소로 가져올 수 있습니다.
- 공개 공유는 로그인 콘티를 `is_public = true`로 바꾸고 `/s/[shareSlug]`에서 읽기 전용으로 보여줍니다.

## Supabase 테이블

- `profiles`: 사용자 프로필, 역할, 교회/예배 기본 정보
- `team_members`: 저장된 팀원 목록
- `saved_songs`: 곡 보관함
- `setlists`: 콘티 본문과 곡 목록 JSON
- `setlist_assignments`: 콘티별 이번 주 팀원 배정
- `practice_presence`: 같은 교회/찬양팀 팀원끼리 보이는 연습중 상태
- `shared_setlists`: 기존 MVP 공유 링크 호환용

## 이미지 업로드 설정

곡 이미지는 앱 서버에 저장하지 않고 Cloudinary에 직접 업로드합니다.

1. Cloudinary에서 unsigned upload preset을 만듭니다.
2. Vercel 환경변수에 `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`을 넣습니다.
3. 앱은 업로드 전에 이미지를 1600px 이하로 줄인 뒤 업로드하고, 곡에는 이미지 주소만 저장합니다.
