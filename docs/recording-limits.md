# 팀 녹음실 사용량 제한 정책

SetlistLab 팀 녹음실은 오디오 파일이 계속 쌓일 수 있으므로 기본 사용량 제한을 둡니다. 제한은 팀 단위로 적용하고, 실험실을 켠 사용자는 테스트 목적으로 quota 제한만 우회합니다.

## 기본 제한

| 항목 | 기본값 |
| --- | --- |
| 팀별 월간 녹음실 생성 | 3개 |
| 녹음실 세션당 활성 트랙 | 12개 |
| 사용자+파트별 재녹음 보관 | 최근 2개 |
| 녹음 파일 1개 최대 크기 | 30MB |
| 녹음 파일 1개 최대 길이 | 10분 |
| 기본 보관 기간 | 60일 |
| 오래된 pending/uploading 정리 | 24시간 후 |
| 오래된 failed 정리 | 7일 후 |

## 실험실 예외

`profiles.lab_enabled = true`인 사용자는 팀 녹음실 quota 제한을 우회합니다.

예외 대상:

- 월간 녹음실 생성 제한
- 세션당 트랙 수 제한
- 파일 크기/길이 제한
- 사용자+파트별 활성 버전 제한

예외가 아닌 것:

- 로그인 확인
- 팀 approved 멤버 확인
- pending/rejected/removed 접근 차단
- R2 presigned upload/read 권한 확인
- cleanup API의 오래된 파일 정리

## DB 테이블

`team_recording_limits`

- 팀별 제한값을 저장합니다.
- row가 없으면 앱 기본값을 사용합니다.
- 리더/부리더만 변경할 수 있고, 팀 approved 멤버는 조회만 할 수 있습니다.

`team_recording_usage_monthly`

- 월별 생성/업로드 사용량을 저장합니다.
- 서버 API가 서비스 롤로 기록합니다.
- 팀 approved 멤버는 현재 사용량을 조회할 수 있습니다.

## 서버 적용 지점

세션 생성:

- `/api/recordings/create-session`
- 월간 팀 녹음실 생성 수를 확인합니다.
- 기본 팀은 한 달 3개 초과 시 세션을 만들 수 없습니다.

업로드 URL 발급:

- `/api/recordings/presign-upload`
- 파일 크기, 길이, 세션당 활성 트랙 수를 확인합니다.
- 클라이언트가 object key를 지정하지 못하게 서버에서 key를 생성합니다.

업로드 완료:

- `/api/recordings/complete-upload`
- 월별 업로드 수와 storage bytes를 증가시킵니다.
- 같은 사용자와 같은 파트의 활성 녹음이 제한을 넘으면 오래된 트랙을 `replaced`로 바꾸고 R2 파일 삭제를 시도합니다.

정리:

- `/api/admin/recordings/cleanup`
- `CRON_SECRET`으로 보호합니다.
- 오래된 `pending_upload`, `uploading`, `failed`, R2 object가 남은 `deleted`/`replaced` 트랙을 정리합니다.

## 보관 기간

기본 보관 기간은 60일입니다. MVP에서는 사용자가 모르는 사이 활성 녹음이 사라지는 일을 피하기 위해 active 트랙을 자동 삭제하지 않습니다.

TODO:

- 보관 만료 7일 전 리더 알림
- 만료된 녹음 자동 아카이브
- 만료된 녹음 R2 삭제
- 후원/Pro 팀 보관 기간 연장

## 운영 참고

- 월별 사용량 row는 실제 세션 count와 함께 비교해 표시합니다.
- 사용량 집계 row 기록에 실패해도 보안을 위해 실제 DB count를 fallback으로 사용합니다.
- quota는 사용자 경험과 비용 보호 목적이며, RLS와 서버 권한 검사를 대체하지 않습니다.
