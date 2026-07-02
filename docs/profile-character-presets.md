# 프로필 캐릭터 에셋 규칙

SetlistLab의 프로필 캐릭터는 완성형 WebP 프리셋을 선택하는 방식입니다.

## 왜 프리셋 방식인가

고품질 캐릭터를 유지하려면 완성형 일러스트 위에 임의 레이어를 얹지 않아야 합니다.

현재 구조:

- 프로필 화면은 저장된 캐릭터 이미지 1개만 로드
- 모달에서 성별과 악기/역할 선택
- 선택한 조합에 대해 `기본`, `소프트`, `웜`, `비비드` 4개 스타일 표시
- 준비된 완성형 이미지 중 하나를 선택

## 에셋 경로

기본 스타일:

```text
public/characters/{gender}-{instrument}.webp
```

추가 스타일:

```text
public/characters/presets/{gender}-{instrument}-{variant}.webp
```

예:

- `female-vocal.webp`
- `presets/female-vocal-soft.webp`
- `presets/female-vocal-warm.webp`
- `presets/female-vocal-vivid.webp`

## 지원 값

성별:

- `female`
- `male`

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

스타일:

- `classic`
- `soft`
- `warm`
- `vivid`

파일명에서는 `_`를 `-`로 바꿉니다.

## DB 저장

`profiles` 테이블:

- `character_config jsonb`
- `character_image_url text`
- `character_thumbnail_url text`
- `character_updated_at timestamptz`

`character_config.presetVariant`가 선택한 스타일을 나타냅니다.

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
- 512x512 또는 1024x1024 이상 원본
- 무대배치도에서 64-96px로 줄여도 실루엣이 잘 보이는 캐릭터

## 무대배치도 연동

준비된 유틸:

- `getUserCharacter(userId)`
- `getTeamMembersWithCharacters(teamId)`

무대배치도에서는 `character_config` 또는 `character_image_url`을 사용해 팀원 캐릭터를 렌더링할 예정입니다.
