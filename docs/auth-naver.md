# 네이버 OAuth 설정 안내

SetlistLab의 네이버 로그인 버튼은 기본적으로 비활성화되어 있습니다. Supabase Auth에서 네이버용 Custom OAuth/OIDC Provider를 설정한 뒤 환경변수로 켜면 로그인/회원가입 화면에 버튼이 표시됩니다.

## 1. 네이버 개발자센터 설정

1. 네이버 개발자센터에서 새 애플리케이션을 생성합니다.
2. 사용 API에서 네이버 로그인 권한을 설정합니다.
3. 서비스 URL에는 배포 주소를 입력합니다.
   - 예: `https://setlistlab.vercel.app`
4. Callback URL은 Supabase Auth가 요구하는 callback URL을 입력합니다.
   - Supabase Dashboard의 Auth Provider 설정 화면에서 표시되는 redirect/callback URL을 기준으로 등록합니다.
   - 로컬 개발과 배포 환경을 모두 쓸 경우 로컬용 callback URL과 배포용 callback URL을 구분해서 추가합니다.

## 2. Supabase Custom OAuth/OIDC Provider 설정

Supabase Dashboard에서 네이버를 Custom OAuth/OIDC Provider로 설정합니다.

필요한 값은 Supabase 프로젝트 설정 방식에 맞춰 입력합니다.

- Client ID: 네이버 개발자센터에서 발급받은 Client ID
- Client Secret: 네이버 개발자센터에서 발급받은 Client Secret
- Authorization URL: 네이버 OAuth authorization endpoint
- Token URL: 네이버 OAuth token endpoint
- User Info URL: 네이버 profile/userinfo endpoint
- Redirect URL: Supabase가 안내하는 callback URL

중요: Client Secret은 절대 `NEXT_PUBLIC_` 환경변수에 넣지 마세요. Secret은 Supabase Dashboard 또는 서버 전용 환경에만 저장해야 합니다.

## 3. Vercel 환경변수

Supabase provider 설정이 끝난 뒤 Vercel Project Settings > Environment Variables에 아래 값을 추가합니다.

```env
NEXT_PUBLIC_ENABLE_NAVER_OAUTH=true
NEXT_PUBLIC_SUPABASE_NAVER_PROVIDER=custom:naver
```

`NEXT_PUBLIC_SUPABASE_NAVER_PROVIDER` 값은 Supabase Dashboard에 설정한 provider id와 정확히 같아야 합니다. provider id가 다르면 이 값을 실제 id로 바꿔 주세요.

## 4. 로컬 개발 환경

로컬에서 테스트하려면 `.env.local`에도 같은 값을 추가합니다.

```env
NEXT_PUBLIC_ENABLE_NAVER_OAUTH=true
NEXT_PUBLIC_SUPABASE_NAVER_PROVIDER=custom:naver
```

그리고 네이버 개발자센터와 Supabase Auth redirect 설정에 로컬 callback 주소도 포함되어 있어야 합니다.

예:

- `http://localhost:3000/auth/callback`
- `http://localhost:3001/auth/callback`
- `https://setlistlab.vercel.app/auth/callback`

## 5. 동작 방식

- 로그인 화면에서는 `네이버로 계속` 버튼이 표시됩니다.
- 회원가입 화면에서는 `네이버로 가입` 버튼이 표시됩니다.
- OAuth는 가입과 로그인이 같은 흐름입니다. 이미 가입한 사용자는 로그인되고, 신규 사용자는 Supabase Auth 사용자로 생성됩니다.
- OAuth callback 후 SetlistLab은 `/auth/callback`에서 세션을 교환하고 프로필을 준비한 뒤 온보딩 또는 요청한 화면으로 이동합니다.

## 6. 주의사항

- 네이버 Client Secret을 클라이언트 코드나 `NEXT_PUBLIC_` 환경변수에 넣지 마세요.
- provider 설정이 끝나기 전에는 `NEXT_PUBLIC_ENABLE_NAVER_OAUTH=false`를 유지하세요.
- provider id가 Supabase 설정과 다르면 네이버 버튼을 눌렀을 때 인증이 시작되지 않습니다.
- 외부 URL로 redirect하지 않도록 앱에서는 `next` 값을 내부 경로로만 제한합니다.
