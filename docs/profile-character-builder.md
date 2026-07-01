# 프로필 캐릭터 만들기

SetlistLab의 `내 캐릭터` 기능은 나중에 무대배치도에서 사용할 팀원 캐릭터를 프로필에 저장하는 기능입니다.

## 현재 노출 정책

- feature key: `profileCharacterBuilder`
- 현재 상태: `admin`
- `admin` 상태에서는 `profiles.is_admin = true` 또는 앱 관리자 사용자만 사용할 수 있습니다.
- 나중에 feature status를 `lab`으로 바꾸면 실험실 사용자가, `public`으로 바꾸면 로그인 사용자 전체가 사용할 수 있습니다.

API에서도 같은 feature flag를 검사하므로 UI를 우회해도 권한 없는 사용자는 저장할 수 없습니다.

## UI 구조

프로필 화면에서는 캐릭터 전체 목록을 렌더링하지 않습니다.

- 프로필 화면: 현재 선택된 캐릭터 이미지 1개만 표시
- 버튼: `캐릭터 만들기` 또는 `캐릭터 변경`
- 모달을 열었을 때만 성별/악기 옵션 표시
- 모달에서도 현재 선택 조합의 미리보기 이미지 1개만 로드

이 구조를 사용하면 캐릭터 에셋이 20개, 40개, 100개로 늘어나도 프로필 진입 트래픽은 증가하지 않습니다.

## 선택 모델

캐릭터는 완성형 WebP/PNG 이미지 에셋을 사용합니다. SVG 레이어 조합이나 얼굴/옷/신발 조합은 이번 MVP에서 사용하지 않습니다.

저장 값:

- `character_gender`: `female` 또는 `male`
- `character_instrument`: `none`, `vocal`, `keyboard`, `electric_guitar`, `acoustic_guitar`, `bass`, `drums`, `cajon`, `leader`, `in_ear`
- `character_image_url`: 서버에서 계산한 이미지 경로
- `character_updated_at`: 저장 시각

서버는 클라이언트가 보낸 이미지 URL을 저장하지 않고, `gender + instrument`를 검증한 뒤 이미지 경로를 계산합니다.

## 이미지 경로 규칙

위치:

- `public/characters/`

규칙:

```text
/characters/{gender}-{instrument}.webp
```

예:

- `/characters/female-vocal.webp`
- `/characters/male-keyboard.webp`
- `/characters/female-electric-guitar.webp`

`instrument` 값의 `_`는 파일명에서 `-`로 바꿉니다.

## 무대배치도 연동 예정

무대배치도에서는 팀원 목록을 가져올 때 다음 값을 함께 사용합니다.

- `profiles.character_gender`
- `profiles.character_instrument`
- `profiles.character_image_url`

TODO:

- 팀원 캐릭터를 드래그 가능한 StageCharacterNode로 렌더링
- 악기/파트와 `character_instrument`를 매칭해 기본 위치 추천
- 캐릭터가 없는 팀원은 기본 캐릭터 사용
