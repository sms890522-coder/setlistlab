# 프로필 캐릭터 만들기

SetlistLab의 `프로필 캐릭터 만들기`는 나중에 만들 무대배치도에서 사용할 개인 캐릭터를 미리 준비하는 기능입니다.

## 현재 노출 정책

- feature key: `profileCharacterBuilder`
- 초기 status: `admin`
- 현재는 `profiles.is_admin = true` 또는 app metadata admin 사용자에게만 표시됩니다.
- 안정화 후 `lib/features.ts`의 status를 `lab`으로 바꾸면 `lab_enabled = true` 사용자에게 열 수 있습니다.
- `public`으로 바꾸면 로그인 사용자 전체에게 공개할 수 있습니다.

## 저장 구조

캐릭터는 이미지 파일이 아니라 JSON 설정으로 저장합니다.

저장 위치:

- `profiles.character_config jsonb`
- `profiles.character_updated_at timestamptz`

기본 구조:

```ts
type StageCharacterConfig = {
  version: 1
  style: 'round' | 'soft' | 'simple'
  faceShape: 'circle' | 'oval' | 'square_round'
  skinTone: 'light' | 'medium' | 'warm' | 'deep'
  hairStyle: 'short' | 'medium' | 'long' | 'curly' | 'cap' | 'none'
  hairColor: 'black' | 'brown' | 'dark_brown' | 'blonde'
  topColor: string
  bottomColor: string
  expression: 'smile' | 'calm' | 'joy' | 'focus'
  item: 'none' | 'mic' | 'keyboard' | 'electric_guitar' | 'acoustic_guitar' | 'bass' | 'drumsticks' | 'cajon' | 'in_ear' | 'leader'
  backgroundColor?: string
}
```

## API

Route:

- `GET /api/profile/character`
- `POST /api/profile/character`

인증:

- Supabase access token을 `Authorization: Bearer ...`로 전달합니다.
- API는 현재 사용자 본인의 캐릭터만 읽고 저장합니다.
- admin이 아닌 사용자는 저장할 수 없습니다.

검증:

- `lib/characters/characterConfig.ts`의 `normalizeCharacterConfig`가 허용된 값만 저장합니다.
- 색상은 `#RRGGBB` 형식만 허용합니다.

## 렌더링

캐릭터는 SVG/React 컴포넌트로 렌더링합니다.

- `components/characters/CharacterPreview.tsx`
- `components/characters/CharacterBuilder.tsx`

이미지 파일을 업로드하지 않기 때문에 Storage 비용이 들지 않고, 나중에 무대배치도에서 크기 조절과 드래그 배치에 재사용하기 쉽습니다.

## 무대배치도 연동 준비

유틸:

- `getUserStageCharacter(userId)`
- `getTeamMembersWithCharacters(teamId)`

TODO:

- 무대배치도에서 팀원 목록을 불러올 때 `profiles.character_config`를 함께 조회
- 캐릭터를 드래그 가능한 `StageCharacterNode`로 렌더링
- 팀원의 파트와 캐릭터 item을 자동 매칭
- 캐릭터가 없는 팀원은 기본 캐릭터 표시
- 필요 시 SVG export 또는 canvas/PNG export 추가
