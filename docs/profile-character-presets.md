# 프로필 캐릭터 프리셋

SetlistLab의 `내 캐릭터 선택` 기능은 무대배치도에서 사용할 개인 캐릭터를 고르는 기능입니다.

## 방식

SVG 레이어 조합이 아니라 완성형 이미지 에셋을 선택합니다.

이 방식을 선택한 이유:

- 캐릭터 완성도를 이미지 에셋 품질로 끌어올릴 수 있음
- 무대배치도에서 64-96px로 줄였을 때 실루엣이 더 안정적임
- 사용자에게 복잡한 커스터마이징 UI를 보여주지 않아도 됨
- 나중에 캐릭터 프리셋만 추가하면 확장 가능

## Feature flag

- key: `profileCharacterBuilder`
- label: `내 캐릭터 선택`
- 현재 status: `admin`

상태별 노출:

- `admin`: `profiles.is_admin = true` 또는 app metadata admin 사용자만 사용
- `lab`: `profiles.lab_enabled = true` 사용자 사용
- `public`: 로그인 사용자 전체 사용
- `disabled`: 비활성화

API에서도 같은 권한을 확인하므로 UI를 우회해도 저장할 수 없습니다.

## DB 저장

`profiles` 테이블:

- `character_preset_id text`
- `character_image_url text`
- `character_updated_at timestamptz`

저장 시 클라이언트가 보낸 이미지 URL은 믿지 않습니다. 서버가 `presetId`를 받아 `CHARACTER_PRESETS`에서 `imageUrl`을 찾아 저장합니다.

## 프리셋 정의

파일:

- `lib/characters/characterPresets.ts`

타입:

```ts
type CharacterPreset = {
  id: string
  name: string
  description?: string
  imageUrl: string
  thumbnailUrl?: string
  category: 'vocal' | 'instrument' | 'leader' | 'casual' | 'etc'
  recommendedPart?: string
}
```

프리셋을 추가하려면:

1. `public/characters`에 이미지 파일 추가
2. `CHARACTER_PRESETS`에 id, 이름, imageUrl 추가
3. 필요하면 category와 recommendedPart 지정

## 에셋 규칙

위치:

- `public/characters/`

권장:

- WebP 우선
- PNG 가능
- 투명 배경
- 1:1 비율
- 512x512 또는 1024x1024 원본
- 작은 크기에서도 알아볼 수 있는 실루엣

이미지가 아직 없으면 앱은 깨진 이미지 대신 placeholder를 보여줍니다.

## 무대배치도 연동 예정

준비된 유틸:

- `getUserCharacter(userId)`
- `getTeamMembersWithCharacters(teamId)`

무대배치도에서는 `character_image_url`을 사용해 `StageCharacterNode` 이미지를 렌더링할 예정입니다.

TODO:

- 파트별 추천 캐릭터 자동 선택
- 색상만 바꾸는 간단 커스터마이징
- 캐릭터 프리셋 추가 업로드
- 캐릭터 PNG/WebP 최적화
- 무대배치도 드래그 배치 연동
- admin 캐릭터 프리셋 관리 화면
