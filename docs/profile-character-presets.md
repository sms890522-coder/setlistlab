# 프로필 캐릭터 에셋 규칙

SetlistLab의 프로필 캐릭터는 완성형 이미지 에셋을 `성별 + 악기/역할` 조합으로 선택합니다.

## 왜 모달 방식인가

프로필 화면에서 모든 캐릭터 이미지를 한 번에 보여주면 에셋이 늘어날수록 트래픽이 커집니다.

현재 구조:

- 프로필 화면은 선택된 캐릭터 이미지 1개만 로드
- `캐릭터 만들기/변경` 모달을 열었을 때만 옵션 표시
- 모달에서도 현재 조합의 미리보기 이미지 1개만 로드

## 에셋 경로

이미지는 `public/characters`에 둡니다.

```text
public/characters/{gender}-{instrument}.webp
```

예:

- `female-none.webp`
- `male-vocal.webp`
- `female-keyboard.webp`
- `male-acoustic-guitar.webp`

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

파일명에서는 `_`를 `-`로 바꿉니다.

## DB 저장

`profiles` 테이블:

- `character_gender text`
- `character_instrument text`
- `character_image_url text`
- `character_updated_at timestamptz`

기존 호환용으로 남아 있는 `character_preset_id`는 새 저장 흐름에서는 사용하지 않습니다.

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

무대배치도에서는 `character_image_url`을 사용해 팀원 캐릭터 이미지를 렌더링할 예정입니다.
