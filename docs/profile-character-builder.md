# 프로필 캐릭터 만들기

SetlistLab의 `내 캐릭터` 기능은 나중에 무대배치도에서 사용할 팀원 캐릭터를 프로필에 저장하는 기능입니다.

## 노출 정책

- feature key: `profileCharacterBuilder`
- 현재 상태: `admin`
- `admin` 상태에서는 `profiles.is_admin = true` 또는 앱 관리자 사용자만 사용할 수 있습니다.
- 나중에 feature status를 `lab`으로 바꾸면 실험실 사용자가, `public`으로 바꾸면 로그인 사용자 전체가 사용할 수 있습니다.

API에서도 같은 feature flag를 검사하므로 UI를 우회해도 권한 없는 사용자는 저장할 수 없습니다.

## UI 구조

프로필 화면에서는 선택된 캐릭터 1개만 표시합니다.

- 프로필 화면: 현재 저장된 캐릭터 이미지만 표시
- 버튼: `캐릭터 만들기` 또는 `캐릭터 변경`
- 모달에서 성별과 악기/역할 선택
- 선택한 성별/역할 조합에 대해 완성형 캐릭터 프리셋 4개 표시
- 사용자는 4개 중 하나를 선택해 저장

즉, 없는 조합을 브라우저에서 억지로 합성하지 않습니다. 각 프리셋은 얼굴/머리, 의상, 역할 아이템 형태가 다르게 보이도록 미리 제작한 완성형 WebP 이미지입니다.

## 저장 모델

캐릭터는 완성형 WebP 이미지를 프리셋으로 선택합니다.

주 저장 값:

- `profiles.character_config jsonb`
- `profiles.character_updated_at timestamptz`

호환용 값:

- `profiles.character_gender`
- `profiles.character_instrument`
- `profiles.character_image_url`
- `profiles.character_thumbnail_url`

`character_image_url`은 선택된 성별/역할/프리셋에 맞는 완성형 이미지 경로입니다.

## character_config

```ts
type CharacterConfig = {
  version: 1
  gender: 'female' | 'male'
  instrument:
    | 'none'
    | 'vocal'
    | 'keyboard'
    | 'electric_guitar'
    | 'acoustic_guitar'
    | 'bass'
    | 'drums'
    | 'cajon'
    | 'leader'
    | 'in_ear'
    | 'engineer'
    | 'broadcast_room'
  presetVariant: 'classic' | 'soft' | 'warm' | 'vivid'
}
```

이전 파츠형 확장을 위해 남아 있는 얼굴/머리/옷 필드는 sanitize 후 저장될 수 있지만, 현재 UI와 렌더링은 완성형 프리셋을 기준으로 동작합니다.

## 이미지 경로

기본 스타일:

```text
public/characters/{gender}-{instrument}.webp
```

추가 스타일:

```text
public/characters/presets/{gender}-{instrument}-{presetVariant}.webp
```

예:

- `public/characters/male-electric-guitar.webp`
- `public/characters/presets/male-electric-guitar-soft.webp`
- `public/characters/presets/male-electric-guitar-warm.webp`
- `public/characters/presets/male-electric-guitar-vivid.webp`

## 무대배치도 연동 예정

무대배치도에서는 팀원 목록을 가져올 때 `profiles.character_config`와 `character_image_url`을 함께 사용합니다.

TODO:

- 팀원 캐릭터를 드래그 가능한 StageCharacterNode로 렌더링
- 악기/역할과 `instrument`를 매칭해 기본 위치 추천
- 캐릭터가 없는 팀원은 기본 캐릭터 사용
