# Edge audit — 2026-10-13 (after maintenance)

Status: LOCAL PASS, parent integration/publication pending. Baseline clean main.

## Inventory and planned executable matrix

Read authority in order: architecture.md, api-spec.md (absent), requirements.md, README.md, docs/decisions.md. Read package/workflow/attributes/ignore, previous verification, all authored dist/src modules, existing tests and browser harness, build/check/serve tools. HTML controls inventoried. CSS responsive rules selected; vendor internals, assets and lockfiles inventoried only.

| Surface / invariant | Existing coverage | New audit cases / evidence |
| --- | --- | --- |
| Numeric inputs | Representative malformed values and fine edits | Table-driven finite/type/min/max/outside cases for each model field |
| Import | Roundtrip and corrupt file | Corrupt/oversize rejection preserves document; delayed A then B; delayed A then edit/new |
| Storage | Some corrupt/quota coverage | Denied read, quota write, readback mismatch, sibling key sentinels; explicit file recovery |
| History / selection | Undo/redo, recent cancel regressions | Branch/no-op/budget boundaries; cancel new/import; invalid edit retains prior project |
| Limits / precision / export | Real existing file downloads | Exact resource endpoints, over-limit rejection, exported precision invariant |
| Async | Some lifecycle checks | Controlled delayed File.text fixture; late completion cannot replace newer input |
| Keyboard / focus | Recent key/movement regression | Text focus, repeated actions, cancelled gesture and next edit |
| Narrow layout | Prior 1440/390/320 | Fresh real inputs at all widths; initial and edited screenshots inspected |

Fixture data is synthetic and explicitly labelled. Browser input and actual downloaded output are distinguished from fixtures. Physical pen/touch, physical GPU certification, external DAW/CAD compatibility: NOT_RUN. API/server/database: N/A (static architecture). Remote CI/live: NOT_RUN.

The initial matrix above was written before execution. Final results follow; baseline-passing cases are coverage additions, never RED_GREEN.

## Executed results and case matrix

LOCAL PASS. Initial main revision: 3416528. Existing tests preserved: 8. New Node tests: 20. Full npm test: **28/28**. New browser scenarios: **12/12** (separate count). Existing browser/export suite also PASS. Parameter-loop assertions are not inflated into separate test counts.

| Feature / invariant | Coverage origin | Executable case / reference | Result |
| --- | --- | --- | --- |
| Numeric schema (13 cases) | NEW | Layer/item opacity, size, x/y, width/height, font size, transform x/y/sx/sy/angle: finite number, both endpoints, outside, null/bool/string, NaN/Infinity serialized rejection | PASS baseline |
| Dimensions/export | NEW + existing | 256/8192 edges, 32MP exact/over, integer/type, portrait 4096x2731 rounding | PASS baseline |
| Resource collections | NEW | 16/17 layers, 5000/5001 items, 64/65 erasers, global ID collision, 50000/50001 stroke points and 300000/300001 aggregate points, pressure0/1/outside | PASS baseline |
| Text/vector | NEW + existing | 2000/2001 Korean chars, hidden layer, transparent SVG; old escaping/ordered erasers/pressure tests retained | PASS baseline |
| History/pattern | NEW + existing | No-op retains redo, detached snapshots, branch, seeded generator endpoints and outliers; old60-count cap retained | PASS baseline |
| Parser bytes | NEW regression | UTF-8 >40MB but character count <40MB must return null before sanitization | FAIL -> PASS |
| Import atomicity/cancel | NEW + existing | tools/edge-browser.mjs: malformed and limit+1-byte files leave old state; valid import dismissal/new cancellation retain history; undo/redo | PASS baseline |
| Storage isolation | NEW fixture coverage | Denied getItem, quota setItem, readback mismatch and corrupt record: edits remain downloadable, old bytes retained, visible save warning; sibling key sentinels unchanged on every scenario | PASS baseline |
| Async import | NEW regression | Delayed File.text A/B completion order; newer committed edit, new document and unblurred typing defeat old A | FAIL -> PASS |
| Focus/narrow UI | NEW + existing | Real fill/Home/Delete/Tab and undo/redo at1440/390/320; initial+edited captures; root horizontal overflow0; retained primary canvas/note/object flows | PASS |

### Actual RED_GREEN evidence

1. Parser byte bound: baseline-tests.log test20 expected null, actually accepted a document whose synthetic Korean padding exceeded 40,000,000 UTF-8 bytes. The model now measures bytes before parsing; same assertion passes.
2. Import ordering: baseline-browser.json records A overwriting B, and late A overwriting an edit/new document. typing-red-browser.json additionally records unfinished text replaced by EDGE stale. Request generations now invalidate on later files, input, commits, undo/redo and pointer interaction. Stale completions/errors do not prompt or replace work.
3. Narrow zoom: screenshot showed a truncated numeric value at320px; zoom-red-browser.json executed FAIL (value5 needed7.16015625px, available7px including native spinner reserve). Only the <=380px input width changed41->66px. Same test now passes5/28.2/100/1600; screenshot final-zoom-1600.png shows the full value.

Unmodified new cases are **coverage additions**. They are not labelled RED_GREEN. Fixture scheduling/error injection is not a real storage device failure or audio/GPU hardware test.

### Commands and artifacts

Run from this app root (Node22+; provided Playwright resolver and installed Chrome executable). This session used owned persistent loopback servers on ephemeral ports; substitute the port printed by serve:

```powershell
node tools/serve.mjs 0
npm test
npm run check
node tools/edge-browser.mjs ../output/playwright/implement-20261012/package.json http://127.0.0.1:PORT/ final
node tools/edge-browser.mjs ../output/playwright/implement-20261012/package.json http://127.0.0.1:PORT/ existing
git diff --check
```

All evidence is ignored under output/playwright/edge-20261013: baseline-tests.log (executed before production edits), baseline-browser.json, typing-red-browser.json, final-tests.log, final-check.log, final-browser.json, existing-run.log, existing/report.json and actual downloads/screenshots. DRAW additionally has zoom-red-browser.json; SCORE additionally has utf8-audio-baseline.log and bytes-red-browser.json. No fabricated old failure runs. The earlier browser baseline had a cross-realm assertion/large-buffer transport harness error; the harness was corrected and rerun against unchanged source before product edits. The corrected baseline artifact is authoritative.

Persistent Playwright Interactive Chrome was isolated, headless and muted; File.text and Storage faults use explicit disposable context fixtures. The retained primary-flow harness runs from the CLI adapter (same pinned Playwright/Chrome, isolated/muted); only URL, output directory, browser ownership and cross-realm value comparison are adapted, not its product assertions. Node REPL string-code generation is unavailable, so that supplemental runner used ordinary Node. Existing test/harness source is unmodified.

Build: N/A for this change; no vendor/build input, dependency, license or generated bundle changed. Full syntax/assets checks run on committed dist bundles. No installation/update required.

### Browser and visual QA

Existing harness: actual 21-point marker, layer opacity/lock refusal, undo/redo, downloaded/reimported JSON, malformed import, 4096x2731 PNG header/content, parsed SVG,8192 over-area export disabled. Additional real exploration:8 drawing/text tools,3 patterns,161-particle refusal,16-layer cap, visibility/blend/order cycles,8192-square refusal/cancel, zoom/fit.

Screenshots reviewed directly: final-initial-1440.png, final-edited-390.png, final-edited-320.png and real edited/export states in existing/. No observed page errors or root horizontal overflow at the tested widths. Mobile layouts intentionally scroll; the piano roll and clay tool strip are their existing internally scrollable regions. Input boxes, main canvas/roll/mesh, toolbar, status and downstream panels were inspected separately. Explore results in exploratory.json and actual captures (not included in automated test count).

UI change: YES: mobile zoom field width only. Parent gallery candidate: output/playwright/edge-20261013/gallery-actual-1440.jpg (actual default sample, 1440x1000, no synthesized visual). Also inspect final-zoom-1600.png and final-edited-320.png. No gallery sibling edited.

### Source accounting and remaining limits

- VERIFIED: all three named app directories inventoried independently; this report concerns only draw-desk. architecture.md -> requirements.md -> README.md, decisions/verification, package.json, .gitattributes, .gitignore, .github/workflows/pages.yml fully read. api-spec.md and repository AGENTS.md absent (N/A); supplied user AGENTS instructions applied.
- VERIFIED authored scope: dist/src/model.js, render.js, app.js; dist/index.html; test/model.test.js; tools/browser-regression.js, verify-browser.mjs, check.mjs, serve.mjs. New test/runner and production diff reviewed. No sibling source used for changes.
- PARTIAL: styles.css responsive/input rules and relevant layout reviewed; not every unrelated cosmetic rule. Font/icon/audio/license binaries and vendored library internals inventoried/static-checked, not fully manually audited. Lockfiles (where present) inventoried; dependency graph not re-audited because unchanged.
- VERIFIED local integration: existing+new npm tests, npm check, browser assertions, diff whitespace and edited-file UTF-8 without BOM / CRLF.
- NOT_RUN: physical pen/multitouch, physical GPU/browser matrix/low-memory devices, DAW/speaker/color/CAD/printer interoperability or certification. Exact maximum resource model bounds are tested where listed; exhaustive worst-case rendering/performance is NOT_RUN.
- NOT_RUN: remote CI/live/publication, commits/pushes/deployments. Parent owns final integration and release; no live claim.
- N/A: API/backend/database/migrations/new resource schema or provider. Architecture and numeric limits retained; no conflicting authority discovered.

Changed paths (8): dist/src/app.js, dist/src/model.js, dist/styles.css, test/edge.test.js, tools/edge-browser.mjs, docs/edge-cases-20261013.md, docs/verification.md, docs/decisions.md. Decision D06 records rationale/options/review. Existing tests preserved. Runtime artifacts stay ignored; parent must retain them separately if needed for release evidence.

