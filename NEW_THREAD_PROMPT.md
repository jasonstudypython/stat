D:\project\lecture 프로젝트 계속 작업.

반드시 먼저 읽을 파일:
- D:\project\lecture\DEVELOPMENT_MANUAL.md
- D:\project\lecture\CODING_RULES.md

프로젝트 개요:
- Next.js 16 + React 19 기반 강의용 통계/회귀 시각화 사이트
- 루트 페이지: HANYANG UNIVERSITY · 2026-1 조직연구방법론
- 그래프 메인: /lab
- GitHub repo: https://github.com/schiz0513/stat

중요 규칙:
- 한글 관련 수정은 apply_patch로만 처리
- shell은 읽기/검색/빌드 위주로만 사용
- 수정 후 반드시 `npm run check:korean` 및 `npm run build` 실행
- app/globals.css는 크므로 해당 페이지 prefix만 찾아서 수정

주요 구현 패턴:
- Plotly 기반 페이지와 SVG 기반 페이지가 섞여 있음
- 페이지별 구현/스타일 구조는 DEVELOPMENT_MANUAL.md 참고

작업 방식:
- 먼저 대상 페이지 파일과 관련 CSS prefix를 찾고
- 필요한 최소 범위만 수정하고
- 마지막에 check/build 결과까지 보고해줘

추가 유지보수 메모:
- 최근 추가된 핵심 페이지:
  - `/lab/multiple-regression-collinearity`
  - `/lab/mediation-effect`
  - `/lab/gender-moderation-effect`
- jamovi 비교용 CSV:
  - `D:\project\lecture\exports\gender-moderation-effect-jamovi.csv`
- `gender-moderation-effect`는 단계별 문구와 정보카드 구성이 다르므로 한 단계 수정 시 다른 단계 텍스트도 같이 점검해줘
- 공통 유틸처럼 보이는 랜덤/행렬 계산 로직이 페이지별로 복제되어 있으니, 리팩터링이 필요하면 수치 동일성부터 먼저 검증해줘

현재 내가 바로 요청할 작업:
- [여기에 현재 요청을 붙여넣기]
Recent maintenance notes (2026-04):
- Shared pure stats helpers now live in `D:\project\lecture\app\lab\_shared\stats.js`
- Shared CSV download helper now lives in `D:\project\lecture\app\lab\_shared\csv.js`
- Shared mobile fit helper now lives in `D:\project\lecture\app\lab\_shared\useMobileFitScale.js`
- Header CSV download buttons are jamovi-oriented and use normal browser download
- Common header button press styling is controlled by:
  - `.lab-header-action-stack`
  - `.lab-header-actions`
  - `.modlab-header-actions`
- Core mobile-optimized pages now mix two patterns:
  - sequential teaching stacks for stage-based pages
  - fixed-width fit scaling for visually dense pages
- Mobile work should prefer page-prefixed rules in `app/globals.css` under `@media (max-width: 820px)`
- `regression-3d` has been removed from the app and from `/lab`
- `t-f-analysis` uses a custom compressed t-axis when `통계량 표시` is on
- `rotating-regression` metrics row and labels have page-specific CSS coupling
