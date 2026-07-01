# 프로필 캐릭터 만들기

프로필 캐릭터 기능은 SVG/CSS 조합형에서 완성형 이미지 프리셋 선택 방식으로 변경되었습니다.

최신 문서:

- `docs/profile-character-presets.md`

요약:

- 사용자는 `내 캐릭터 선택` 섹션에서 프리셋 캐릭터를 고릅니다.
- 서버는 `presetId`를 검증하고 `character_preset_id`, `character_image_url`을 프로필에 저장합니다.
- 실제 이미지 에셋은 `public/characters`에 둡니다.
- 무대배치도에서는 저장된 `character_image_url`을 사용합니다.
