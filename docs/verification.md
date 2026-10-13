# Verification — 2026-10-09

## 2026-10-13 창작 편집 점검 — LOCAL / 통합 대기

- SOURCE VERIFIED: 저장소 인벤토리, architecture.md → requirements.md → README.md, docs/decisions.md와 이 검증 문서, .gitattributes/ignore/workflow, model/render/app, HTML, 기존 모델 테스트와 check/serve. api-spec.md와 AGENTS.md는 없음. SOURCE PARTIAL: 기존 CSS는 관련 레이아웃만 검토; vendor가 없는 이 앱의 폰트/라이선스·아이콘 바이너리는 인벤토리와 정적 자산 검사 범위. 다른 저장소/갤러리는 수정하지 않음.
- 재현→수정: Esc로 취소한 드래그의 x=115.27377521613835가 다음 저장에 섞임; 굵기만 바꿨는데 #de895e 채움이 none으로 바뀜. tools/browser-regression.js가 수정 전 두 실패를 재현했고 수정 후 PASS. 취소/도구 전환·blur·pinch 진입은 원래 변환 복구, 스타일은 해당 필드만 변경. 파일 저장은 진행 중 포인터 편집을 완료함.
- 콘텐츠/UI: 접을 수 있는 해안선 연습(0.1px 변환, 잠금·마커·레이어, 시드12864/힘0.5↔0.501 비교, JSON 왕복) 추가. 모바일 안내를 전체 너비로 배치. UI change: YES. 안내 수치의 근거는 src/model.js·app.js·render.js와 기존 패턴/정밀도 테스트이며, 외부 과학 평가나 학습 점수를 추가하지 않음.
- LOCAL: npm test **8/8 PASS**, npm run check **8 public files PASS**, git diff --check PASS. 추가 브라우저 스크립트 구문 검사 PASS. 테스트 수에 브라우저 검사를 합산하지 않음.
- ACTUAL BROWSER: 음소거된 독립 Chrome headless 컨텍스트, 127.0.0.1:4291. 21점 마커 선/레이어55%/잠금 시 그리기 차단, undo/redo, 실제 JSON 다운로드→파일 불러오기(레이어·선·잠금 보존), 잘못된 파일과 손상된 저장 보존. 실제 PNG **4096×2731**, SVG XML 파싱, 8192 긴 변의 면적 초과 거절. 1440×1000/390×900/320×900 root overflow0, 좁은 화면 실제 그리기·undo, 관찰된 page errors0.
- 재실행: 서버 `node tools/serve.mjs 4291`; `node tools/verify-browser.mjs ../output/playwright/implement-20261012/package.json` (부모에 제공된 Playwright 설치 필요; 현재 Windows Chrome 실행 경로 사용). 결과/캡처/다운로드: ignored `output/playwright/qa-20261013/`; report.json, desktop.png, mobile-390.png, mobile-320.png, full-4096.png, roundtrip.draw.json, drawing.svg. 데스크톱은 시작 샘플+펼친 안내, 모바일은 그린 선/잠근 레이어+안내/잘못된 파일 알림 상태. 주요 selectors: #practice, #canvas, #layer-opacity, #layer-lock, #open-file, #export-png.
- NOT_RUN: 물리 펜/멀티터치, 모든 브라우저/저메모리 기기, 전문 색상/외부 편집기 호환성. REMOTE_CI/LIVE/commit/push/deploy는 이번 작업에서 실행하지 않음. D05 참조.
- 통합 파일(7): dist/src/app.js, dist/index.html, dist/styles.css, docs/decisions.md, docs/verification.md, tools/browser-regression.js, tools/verify-browser.mjs. 모두 UTF-8 no BOM / CRLF 확인. ignored QA 결과는 별도 보관.

## 2026-10-10 REMOTE_CI / LIVE

Implementation commit `80805644582f92939950c9b2fdae905dca062470`: [verify/deploy PASS](https://github.com/HyungminYoon1/draw-desk/actions/runs/37947839020). Public Pages uses the verified GitHub origin; normal pushes only.

LIVE HTTP: all 8 public dist files returned HTTP200 and matched the local verified SHA256 bytes. Across six affected services, 151/151 files matched after the gallery deployment completed.

LIVE BROWSER / EXPORT: actual 29-point pointer stroke, numeric subpixel displacement 0.099609705px after 0.1px UI adjustment (rounding <0.001px), undo/redo and project JSON. Downloaded actual 4096x2731 PNG; vector SVG parsed as XML (46 elements), no script/inline-event content. Desktop 1440 and mobile 390/320 without overflow or observed page errors.

The existing shared completion string was unchanged. Creative files stay browser-local; individual own keys are a code contract, not origin isolation between GitHub Pages paths. Physical hardware, all browsers and independent expert interoperability/scientific review remain NOT_RUN. This evidence update changes docs only.



LOCAL MODEL: 8/8 tests. Floating-point/pressure document round trip, distinct pressure outline geometry, unsafe/malformed/bounded project imports, XML escaping, undo/redo branch/count limits, centered transforms, true export dimensions and over-budget refusal, randomized editable patterns including maximum settings, ordered layer-local SVG erasing.

LOCAL STATIC: syntax, assets, CSP without external connections, own project-only state and duplicate HTML IDs passed. Pretendard v1.3.9 unmodified WOFF2 and full OFL independently read/retained. Formatted UTF-8 no BOM / CRLF.

LOCAL BROWSER: real Playwright CLI Chromium. New layer and actual 29-sample mouse stroke persisted; numeric center change kept approximately 0.1px (display rounding changes underlying offset by <0.001px), undo/redo; repeated identical pattern seeds created two valid distinct-ID editable layers; one undone. Downloaded/reimported actual 4-layer/116-object JSON. Real PNG header and rendered image 4096×2731, 3,628,594 bytes; actual SVG XML parsed with 115 paths and no script elements. 1440/390/320px had no page-level overflow. Initial resize retained old zoom; corrected automatic fit until deliberate viewport manipulation. Native import confirmation completed; a subsequent CLI dialog command found it already accepted (tool timing, not app failure).

NOT_RUN: physical pressure pen hardware, every touch/browser/GPU, calibrated color/CMYK/PSD compatibility, very large 32MP exports on low-memory devices, formal WCAG review. Pressure model is tested, not a claim of physical stylus certification. Updated multi-line SVG text is included in model/static tests; final live checks recorded separately.

FINAL LOCAL TEXT: actual text tool/prompt and inspector produced two Korean lines containing <&>. Downloaded SVG parsed as XML with two tspans and escaped special characters. No forced textLength stretch. This confirms the implemented multi-line flow, not cross-device font equivalence.

REMOTE CI / LIVE: not yet run at this point.
