# 사용설명서 이미지

`/guide` 사용설명서에 실제 화면 이미지를 넣으려면 이 폴더에 PNG 이미지를 추가하세요.

- 모바일 캡처: `public/guide/*.png`
- PC 캡처: `public/guide/desktop/*.png`

현재 `app/guide/page.tsx`의 `guideImages` 설정에 연결된 파일명은 다음과 같습니다.

- `create-setlist.png`
- `song-form-editor.png`
- `view-setlist.png`
- `youtube-practice.png`
- `loop-control.png`
- `playback-speed.png`
- `song-form-navigation.png`
- `score-image.png`
- `pdf-export.png`
- `pdf-customize.png`
- `team-dashboard.png`
- `team-invite.png`
- `team-chat.png`
- `team-notice.png`
- `team-calendar.png`
- `availability-check.png`
- `tuner.png`
- `metronome.png`

이미지 파일이 없으면 해당 이미지 영역은 표시되지 않습니다. 깨진 이미지 아이콘이나 빈 박스가 보이지 않도록 서버에서 파일 존재 여부를 확인합니다. PC 이미지가 있으면 넓은 화면에서 PC 이미지를 표시하고, 없으면 모바일 이미지를 사용합니다.
