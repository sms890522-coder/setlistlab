# 네이버 OAuth 설정 안내

SetlistLab의 네이버 로그인은 Supabase Custom OAuth Provider와 Edge Function UserInfo Proxy를 함께 사용합니다. 네이버 원본 UserInfo 응답은 `response.email`처럼 중첩되어 있어 Supabase Auth가 이메일을 읽지 못할 수 있으므로, Edge Function이 응답을 평탄화해서 전달합니다.

## 1. Edge Function 배포

먼저 네이버 UserInfo Proxy 함수를 배포합니다.

```bash
npx supabase functions deploy naver-userinfo-proxy --no-verify-jwt --project-ref djbkjkbsuhszkwooqpvx
```

배포 후 UserInfo URL은 아래 주소입니다.

```text
https://djbkjkbsuhszkwooqpvx.supabase.co/functions/v1/naver-userinfo-proxy
```

Supabase Auth가 네이버 access token을 들고 이 함수를 호출하므로 `--no-verify-jwt` 배포가 필요할 수 있습니다.

## 2. Supabase Custom OAuth/OIDC Provider 설정

Supabase Dashboard에서 `Authentication` → `Sign In / Providers` → `Custom OAuth/OIDC Provider`로 이동한 뒤 아래 값으로 설정합니다.

| 항목 | 값 |
| --- | --- |
| Provider identifier | `custom:naver` |
| Authorization URL | `https://nid.naver.com/oauth2.0/authorize` |
| Token URL | `https://nid.naver.com/oauth2.0/token` |
| UserInfo URL | `https://djbkjkbsuhszkwooqpvx.supabase.co/functions/v1/naver-userinfo-proxy` |
| Client ID | 네이버 개발자센터 Client ID |
| Client Secret | 네이버 개발자센터 Client Secret |
| Scopes | `profile email` |

중요: UserInfo URL에 `https://openapi.naver.com/v1/nid/me`를 직접 넣지 마세요. 반드시 Edge Function Proxy URL을 넣어야 합니다. 네이버 원본 응답은 `response.email` 구조라 Supabase가 직접 이메일을 읽지 못해 `Error getting user email from external provider` 오류가 날 수 있습니다.

## 3. 네이버 개발자센터 설정

네이버 개발자센터에서 애플리케이션을 만들고 네이버 로그인 API를 활성화합니다.

서비스 URL:

```text
https://setlistlab.vercel.app
```

Callback URL:

```text
https://djbkjkbsuhszkwooqpvx.supabase.co/auth/v1/callback
```

필수 제공 정보:

- 이메일 주소
- 이름 또는 별명
- 프로필 이미지, 선택

이메일 제공 항목이 꺼져 있거나 사용자가 이메일 제공에 동의하지 않으면 Supabase 유저 생성이 실패할 수 있습니다.

## 4. Vercel 환경변수

Supabase provider 설정과 Edge Function 배포가 끝난 뒤 Vercel Project Settings → Environment Variables에 아래 값을 추가합니다.

```env
NEXT_PUBLIC_ENABLE_NAVER_OAUTH=true
NEXT_PUBLIC_SUPABASE_NAVER_PROVIDER=custom:naver
```

설정이 끝나기 전에는 `NEXT_PUBLIC_ENABLE_NAVER_OAUTH=false`를 유지하세요. Client Secret은 절대 `NEXT_PUBLIC_` 환경변수에 넣지 말고 Supabase Dashboard에만 저장합니다.

## 5. 로컬 개발 환경

로컬에서 버튼을 보이게 하려면 `.env.local`에도 아래 값을 추가합니다.

```env
NEXT_PUBLIC_ENABLE_NAVER_OAUTH=true
NEXT_PUBLIC_SUPABASE_NAVER_PROVIDER=custom:naver
```

로컬 테스트는 Supabase Auth callback이 배포 프로젝트 기준으로 동작하므로, 우선 배포 URL에서 테스트하는 것을 권장합니다.

## 6. UserInfo Proxy 동작

`supabase/functions/naver-userinfo-proxy/index.ts`는 네이버 UserInfo API 응답을 아래처럼 Supabase Auth가 읽을 수 있는 최상위 필드로 변환합니다.

```json
{
  "sub": "naver-user-id",
  "id": "naver-user-id",
  "email": "user@naver.com",
  "email_verified": true,
  "name": "홍길동",
  "nickname": "닉네임",
  "avatar_url": "https://...",
  "picture": "https://...",
  "provider": "naver"
}
```

토큰은 로그에 남기지 않습니다. 네이버 응답에 `id`나 `email`이 없으면 오류 JSON을 반환합니다.

## 7. 테스트 순서

1. Edge Function을 배포합니다.
   ```bash
   npx supabase functions deploy naver-userinfo-proxy --no-verify-jwt --project-ref djbkjkbsuhszkwooqpvx
   ```
2. Supabase Custom OAuth Provider의 UserInfo URL을 Proxy URL로 설정합니다.
   ```text
   https://djbkjkbsuhszkwooqpvx.supabase.co/functions/v1/naver-userinfo-proxy
   ```
3. 네이버 개발자센터 Callback URL을 확인합니다.
   ```text
   https://djbkjkbsuhszkwooqpvx.supabase.co/auth/v1/callback
   ```
4. Vercel 환경변수를 활성화합니다.
   ```env
   NEXT_PUBLIC_ENABLE_NAVER_OAUTH=true
   NEXT_PUBLIC_SUPABASE_NAVER_PROVIDER=custom:naver
   ```
5. 배포 사이트에서 네이버로 회원가입을 시도합니다.
6. Supabase Dashboard → Authentication → Users에서 새 유저가 생성됐는지 확인합니다.
7. 유저의 `email` 값이 비어 있지 않은지 확인합니다.
8. `profiles` 테이블에 프로필 row가 생성 또는 보완됐는지 확인합니다.
9. 로그인 후 온보딩 또는 요청한 화면으로 이동하는지 확인합니다.

## 8. 실패 시 체크리스트

유저가 생성되지 않을 때:

- Supabase Provider의 UserInfo URL이 Edge Function Proxy URL인가요?
- 네이버 원본 UserInfo URL을 직접 넣은 것은 아닌가요?
- Edge Function이 `naver-userinfo-proxy` 이름으로 배포되어 있나요?
- `--no-verify-jwt`로 배포했나요?
- 네이버 개발자센터에서 이메일 제공 항목이 켜져 있나요?
- Supabase Auth logs에 `Error getting user email from external provider`가 남나요?
- Edge Function logs에 `naver_email_missing`이 남나요?

`404` 또는 Function not found:

- 함수 이름이 `naver-userinfo-proxy`인지 확인하세요.
- 배포 project ref가 `djbkjkbsuhszkwooqpvx`인지 확인하세요.

`401`:

- Supabase Auth가 Authorization 헤더를 함수로 전달하는지 확인하세요.
- `--no-verify-jwt` 배포 여부를 확인하세요.

앱에서 버튼이 보이지 않을 때:

- Vercel 환경변수 `NEXT_PUBLIC_ENABLE_NAVER_OAUTH=true`인지 확인하세요.
- `NEXT_PUBLIC_SUPABASE_NAVER_PROVIDER=custom:naver`인지 확인하세요.
- 환경변수 변경 후 Vercel 재배포를 했는지 확인하세요.

## 9. 앱 동작

- 로그인 화면에서는 `네이버로 계속` 버튼이 표시됩니다.
- 회원가입 화면에서는 `네이버로 가입` 버튼이 표시됩니다.
- OAuth는 가입과 로그인이 같은 흐름입니다. 이미 가입한 사용자는 로그인되고, 신규 사용자는 Supabase Auth 사용자로 생성됩니다.
- OAuth callback 후 SetlistLab은 `/auth/callback`에서 세션을 교환하고 프로필을 준비한 뒤 온보딩 또는 요청한 화면으로 이동합니다.
- 소셜 로그인에서 이메일 정보를 가져오지 못하면 로그인 화면에 친절한 오류 메시지를 표시합니다.
