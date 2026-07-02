# 프로필 캐릭터 에셋 규칙

SetlistLab의 프로필 캐릭터는 완성형 1장 선택이 아니라, PNG/WebP 투명 배경 파츠를 겹쳐 만드는 방식입니다.

## 왜 모달 방식인가

프로필 화면에서 모든 파츠나 조합 이미지를 한 번에 보여주면 에셋이 늘어날수록 트래픽이 커집니다.

현재 구조:

- 프로필 화면은 저장된 캐릭터에 필요한 파츠만 로드
- `캐릭터 만들기/변경` 모달을 열었을 때만 옵션 UI 표시
- 옵션 버튼에는 큰 이미지 썸네일을 쓰지 않음
- 미리보기는 현재 선택 조합의 레이어만 로드

## 에셋 경로

파츠 이미지는 `public/characters/layers`에 둡니다.

```text
base/{gender}-body-01.webp
face/face-{faceShape}-01.webp
expression/{expression}-01.webp
hair/{gender}-{hairStyle}-01-{hairColor}.webp
outfit-top/top-{topStyle}-01-{topColor}.webp
outfit-bottom/bottom-basic-01-{bottomColor}.webp
instrument/{instrument}.webp
```

파일명에서는 타입 값의 `_`를 `-`로 바꿉니다.

## 지원 값

성별:

- `female`
- `male`

얼굴형:

- `round`
- `oval`
- `soft_square`

표정:

- `smile`
- `calm`
- `joy`
- `focus`

헤어:

- `short`
- `medium`
- `long`
- `wave`
- `ponytail`

악기/역할:

- `none`
- `vocal`
- `keyboard`
- `electric_guitar`
- `acoustic_guitar`
- `bass`
- `drums`
- `cajon`
- `leader`
- `in_ear`
- `engineer`
- `broadcast_room`

## DB 저장

`profiles` 테이블:

- `character_config jsonb`
- `character_thumbnail_url text`
- `character_updated_at timestamptz`

기존 호환용으로 남아 있는 `character_gender`, `character_instrument`, `character_image_url`, `character_preset_id`는 새 저장 흐름의 보조값입니다.

## Feature flag

- key: `profileCharacterBuilder`
- 현재 status: `admin`

상태별 노출:

- `admin`: admin 사용자만 사용
- `lab`: 실험실 사용자가 사용
- `public`: 로그인 사용자 전체 사용
- `disabled`: 비활성화

## 에셋 권장 규격

- WebP 우선
- 투명 배경
- 1:1 비율
- 모든 파츠는 같은 캔버스 크기와 기준점 사용
- 512x512 또는 1024x1024 이상 원본
- 무대배치도에서 64-96px로 줄여도 실루엣이 잘 보이는 캐릭터

## 무대배치도 연동

준비된 유틸:

- `getUserCharacter(userId)`
- `getTeamMembersWithCharacters(teamId)`

무대배치도에서는 `character_config`를 `CharacterPreview` 레이어로 렌더링할 예정입니다.
