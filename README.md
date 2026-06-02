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
- JSON 내보내기/가져오기
- Supabase 공유 링크 생성

## Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. `supabase/schema.sql` 내용을 Supabase SQL Editor에서 실행합니다.
3. Vercel 환경변수에 아래 값을 설정합니다.

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

4. Vercel에서 다시 배포합니다.
