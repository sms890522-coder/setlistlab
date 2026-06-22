# 사용설명서 화면 이미지 생성

`/guide` 사용설명서에 들어가는 이미지는 실제 앱 스타일의 캡처 전용 데모 화면을 Playwright로 촬영해 생성합니다.

## 1. 개발 서버 실행

```bash
npm run dev
```

기본 캡처 주소는 `http://localhost:3000`입니다.

다른 포트로 실행 중이면 환경변수로 지정합니다.

```bash
GUIDE_SCREENSHOT_BASE_URL=http://localhost:3001 npm run guide:screenshots
```

## 2. 스크린샷 생성

```bash
npm run guide:screenshots
```

처음 실행하는 환경에서 Playwright 브라우저가 없다는 오류가 나면 아래 명령으로 Chromium을 설치합니다.

```bash
npx playwright install chromium
```

## 3. 생성 위치

생성된 PNG 파일은 모바일/PC 기준으로 각각 저장됩니다.

```text
public/guide/          # 모바일 캡처, 390 x 844
public/guide/desktop/  # PC 캡처, 1280 x 900
```

`/guide` 페이지는 `app/guide/page.tsx`의 `guideImages` 설정과 같은 파일명이 존재할 때만 이미지를 표시합니다. PC 화면에서는 `public/guide/desktop/`, 모바일 화면에서는 `public/guide/` 이미지를 우선 사용합니다. 이미지가 없으면 깨진 이미지 아이콘이나 빈 박스가 표시되지 않습니다.

## 4. 캡처 전용 데모 페이지

스크린샷은 로그인이나 Supabase 데이터 없이 안정적으로 캡처할 수 있도록 `/guide/demo/*` 페이지를 사용합니다.

주요 경로:

- `/guide/demo/create-setlist`
- `/guide/demo/view-setlist`
- `/guide/demo/youtube-practice`
- `/guide/demo/pdf-export`
- `/guide/demo/team-dashboard`
- `/guide/demo/team-chat`
- `/guide/demo/team-calendar`
- `/guide/demo/practice-tools`

이 페이지들은 프로덕션 메뉴에 노출되지 않으며, `metadata.robots`로 `noindex, nofollow` 처리되어 검색엔진에 노출되지 않습니다.

## 5. 실패 시 확인할 것

- 개발 서버가 켜져 있는지 확인합니다.
- 포트가 다르면 `GUIDE_SCREENSHOT_BASE_URL`을 지정합니다.
- Playwright 브라우저가 설치되어 있는지 확인합니다.
- 캡처 대상의 `data-guide-shot` 값이 테스트 파일과 일치하는지 확인합니다.

이 스크린샷 생성 작업은 선택 작업입니다. `npm run build`에는 연결되어 있지 않으므로 Playwright 실행이 어려운 환경에서도 일반 빌드는 영향을 받지 않습니다.
