# 네이버 브랜드 검색 홈 우선순위 정리

네이버에서 `콘티연습실`을 검색했을 때 사용설명서보다 홈 페이지가 대표 페이지로 인식되도록 SEO 신호를 정리했습니다.

## 적용 내용

- 홈 기본 title을 `콘티연습실 | 찬양팀 콘티 작성 · 연습 · 팀 공유 도구`로 유지
- 홈 description을 찬양팀 콘티 작성, 유튜브 연습, PDF 저장, 팀 공유 중심으로 정리
- 홈 canonical을 `https://setlistlab.vercel.app/`로 지정
- 홈 Open Graph title/description/url 강화
- 홈에 `WebSite`, `SoftwareApplication` structured data 추가
- 홈 H1을 `찬양팀 콘티 준비와 연습을 더 쉽게`로 정리
- 사용설명서 title을 `사용설명서 | 콘티연습실`로 변경
- 사용설명서 H1을 `사용설명서`로 변경
- 사용설명서 canonical을 `https://setlistlab.vercel.app/guide`로 유지
- 사용설명서에 breadcrumb와 홈으로 가는 CTA 링크 추가
- sitemap에서 홈 priority를 `1`, 사용설명서 priority를 `0.5`로 조정

## 왜 사용설명서를 noindex 하지 않았나

사용설명서는 검색 유입 가치가 있는 페이지입니다. 이번 작업의 목표는 사용설명서를 검색에서 제거하는 것이 아니라, 브랜드명 `콘티연습실` 검색에서 홈이 대표 페이지로 보이도록 신호를 정리하는 것입니다.

TODO:

- 네이버에서 계속 사용설명서가 홈보다 먼저 노출될 경우, guide 페이지 noindex 또는 검색 노출 제한을 검토합니다.
- 단, 이 경우 사용설명서 검색 유입이 줄어들 수 있습니다.

## 배포 후 체크리스트

- [ ] 배포 완료
- [ ] `https://setlistlab.vercel.app/sitemap.xml` 확인
- [ ] `https://setlistlab.vercel.app/robots.txt` 확인
- [ ] 홈 canonical이 `https://setlistlab.vercel.app/`인지 확인
- [ ] guide canonical이 `https://setlistlab.vercel.app/guide`인지 확인
- [ ] 네이버 서치어드바이저에서 홈 URL 수집 요청
- [ ] 네이버 서치어드바이저에서 sitemap 재제출
- [ ] 네이버 서치어드바이저 사이트 최적화 확인
- [ ] 1~2주 후 `콘티연습실` 검색 결과 확인

## 참고

검색 결과 반영은 배포 직후 바로 바뀌지 않을 수 있습니다. 네이버 수집/재평가 주기에 따라 며칠에서 1~2주 이상 걸릴 수 있습니다.
