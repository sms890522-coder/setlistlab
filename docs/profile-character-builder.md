# 프로필 캐릭터 만들기

SetlistLab의 `내 캐릭터` 기능은 나중에 무대배치도에서 사용할 팀원 캐릭터를 프로필에 저장하는 기능입니다.

## 노출 정책

- feature key: `profileCharacterBuilder`
- 현재 상태: `admin`
- `admin` 상태에서는 `profiles.is_admin = true` 또는 앱 관리자 사용자만 사용할 수 있습니다.
- 나중에 feature status를 `lab`으로 바꾸면 실험실 사용자가, `public`으로 바꾸면 로그인 사용자 전체가 사용할 수 있습니다.

API에서도 같은 feature flag를 검사하므로 UI를 우회해도 권한 없는 사용자는 저장할 수 없습니다.

## UI 구조

프로필 화면에서는 캐릭터 전체 파츠 목록을 렌더링하지 않습니다.

- 프로필 화면: 현재 저장된 `character_config`에 필요한 파츠만 표시
- 버튼: `캐릭터 만들기` 또는 `캐릭터 변경`
- 모달을 열었을 때만 커스터마이징 UI 표시
- 옵션 버튼은 텍스트/색상칩 중심으로 구성
- 큰 이미지는 현재 미리보기 조합의 파츠만 로드

이 구조를 사용하면 파츠가 늘어나도 프로필 진입 트래픽은 현재 캐릭터에 필요한 레이어 수만큼으로 제한됩니다.

## 저장 모델

캐릭터는 완성형 1장 이미지가 아니라 PNG/WebP 투명 배경 파츠를 조합합니다. 최종 PNG는 저장하지 않고 설정값만 저장합니다.

주 저장 값:

- `profiles.character_config jsonb`
- `profiles.character_updated_at timestamptz`

호환용 값:

- `profiles.character_gender`
- `profiles.character_instrument`
- `profiles.character_image_url`
- `profiles.character_thumbnail_url`

`character_image_url`은 이전 완성형 이미지 방식과의 호환용이며, 새 렌더링은 `character_config`를 기준으로 합니다.

## character_config

```ts
type CharacterConfig = {
  version: 1
  gender: 'female' | 'male'
  faceShape: 'round' | 'oval' | 'soft_square'
  expression: 'smile' | 'calm' | 'joy' | 'focus'
  hairStyle: 'short' | 'medium' | 'long' | 'wave' | 'ponytail'
  hairColor: 'black' | 'brown' | 'dark_brown' | 'light_brown'
  topStyle: 'basic' | 'hoodie' | 'neat' | 'worship'
  topColor: 'black' | 'white' | 'blue' | 'indigo' | 'green' | 'beige'
  bottomColor: 'black' | 'navy' | 'gray'
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
}
```

서버는 입력값을 `normalizeCharacterConfig`로 sanitize한 뒤 저장합니다. 클라이언트가 임의 이미지 URL을 저장할 수 없습니다.

## 파츠 레이어 경로

파츠는 `public/characters/layers` 아래에 둡니다.

```text
public/characters/layers/base/{gender}-body-01.webp
public/characters/layers/face/face-{faceShape}-01.webp
public/characters/layers/expression/{expression}-01.webp
public/characters/layers/hair/{gender}-{hairStyle}-01-{hairColor}.webp
public/characters/layers/outfit-top/top-{topStyle}-01-{topColor}.webp
public/characters/layers/outfit-bottom/bottom-basic-01-{bottomColor}.webp
public/characters/layers/instrument/{instrument}.webp
```

모든 파츠는 같은 1:1 캔버스와 기준점으로 제작해야 합니다.

## 무대배치도 연동 예정

무대배치도에서는 팀원 목록을 가져올 때 `profiles.character_config`를 함께 사용합니다.

TODO:

- 팀원 캐릭터를 드래그 가능한 StageCharacterNode로 렌더링
- 악기/역할과 `instrument`를 매칭해 기본 위치 추천
- 캐릭터가 없는 팀원은 기본 캐릭터 사용
- 필요하면 서버에서 `character_thumbnail_url` 생성
