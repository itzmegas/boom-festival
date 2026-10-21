# Interactive Boom Map — Accessibility Remediation

## Objective and Scope
Restore keyboard focus after Escape from a POI opened through a filtered list and add automated axe evidence for Phase 4 task 4.2. Preserve completed Phases 1–3 and task 4.1, canonical semantic navigation, original assets, and unofficial/non-GPS framing.

## Authorization and Constraints
- Maintainer explicitly authorized the previously requested bounded remediation on 2026-10-03: at most 200 authored changed lines, excluding generated lockfile changes.
- Installed Gentle AI 4.0.0 has no `sdd-attempt` or `sdd-status` command. No legacy reset or settlement is claimed; legacy state stays untouched.
- Strict TDD applies to new behavior: observe a failing filtered-navigation Playwright regression before production edits, then GREEN and focused refactoring. Historical Phases 2–3 retain their accepted Standard Mode exception.
- Preserve pre-existing `.atl/skill-registry.md` and `.atl/.skill-registry.cache.json` changes. No push, PR, merge, deployment, or remote execution.
- Manual screen-reader checks require genuine human evidence. Axe and Chromium accessibility-tree checks are not substitutes.

## Delivery and Forecast
- Route: delegated direct; multi-file implementation and reading that prepares a write require one bounded writer.
- Forecast: 80–160 authored changed lines, generated lockfile excluded; below the authorized 200-line scope.
- Existing chain strategy: feature-branch-chain. This remediation is one coherent fix-and-tests slice; no PR creation is authorized.
- Normalization: no formatter script in package.json; no source-mutating normalizer is currently required.

## Checklist
- [x] A1 Restore filtered-navigation focus and add axe automation with observed RED/GREEN.
  - Allowed production surfaces: `src/components/PoiList.astro`, `src/components/MapCanvas.astro`, `src/components/PoiDetail.astro` only as needed.
  - Allowed checks/dependency surfaces: `tests/e2e/map.spec.ts`, `tests/e2e/semantic.spec.ts`, `package.json`, `package-lock.json`.
  - Acceptance: originating POI link receives focus after Escape from both landing and filtered-category journeys; existing WebGL-disabled behavior remains usable; relevant routes have no actionable axe violations.
  - Verification: `npm run check`; `npx vitest run`; `ASTRO_DEV_BACKGROUND=0 npx playwright test`; `npm run build`.
- [ ] A2 Independently verify the exact diff and persist truthful Phase 4 evidence.
  - Run native risk assessment and follow enabled candidate review consent before native review work.
  - Keep manual assistive-technology evidence explicitly pending when unavailable; do not mark the original task 4.2 complete without its required evidence.

## Progress and Evidence
- Resume reconciliation: Engram tasks #997 and apply-progress #1009 are revision 8, with 10/11 tasks complete.
- Root-cause readback: return-focus click recording exists only in MapCanvas, which filtered-category pages do not include.
- Writer observed RED: filtered-list Playwright regression failed with the Yoga Dome link inactive after Escape, before production edits. GREEN: filtered-list and storage-unavailable regressions both passed. Shared behavior now lives in PoiList; MapCanvas no longer owns semantic focus.
- Independent verification: `npm run check` passed (31 files, zero diagnostics); `npx vitest run` passed (21 tests, 5 files); `ASTRO_DEV_BACKGROUND=0 npx playwright test` passed (14 Chromium tests); `npm run build` passed (50 pages); `git diff --check` passed. All independent commands passed on first execution.
- Parent spot check: the filtered-list and unavailable-storage regressions passed (2 tests).
- Axe: zero tagged WCAG 2.1 A/AA violations across landing, category, detail, empty-edition, and unknown-POI routes. This does not establish full WCAG compliance.
- Writer reported one intermediate concurrent failure of the existing skip-link focus assertion; isolated rerun and final full suites passed. Independent verification observed no fresh failures.
- Source/tests/dependency manifest: 102 authored changed lines; generated lockfile: 24 changed lines. Task-document additions are tracked separately and remain within the authorized authored scope combined.
- Existing build warning: lazy minified scene chunk exceeds 500 kB. No build failure.
- Manual screen reader: NOT RUN. Current exhaustive Tab traversal, visual focus contrast measurement, and 200%-equivalent reflow were not repeated; prior Phase 4 evidence remains historical, not fresh.
- Original task 4.2 remains pending. Static-output configuration is unchanged; hosting remains unspecified. No manifest/service-worker integration was found in bounded inspection.
- Native review: awaiting candidate preflight and consent; no native reset, settlement, or approval is claimed.
- Commit identity: none; no commit, push, or PR created during this remediation.
- Next step: native candidate review if consented, then obtain genuine remaining manual accessibility evidence before closing original task 4.2.

## Rollback
Revert only this remediation's component, dependency, test, and task-document deltas. Preserve all prior map implementation, content, legacy evidence, and unrelated registry changes.

## Authorized Follow-up — Rendering and Marker Navigation
- On 2026-10-03 the maintainer explicitly authorized fixing the black texture, retaining the fallback on load failure, and opening the existing POI detail from a marker click. This is a new candidate; the previous approved focus/axe review is not reopened.
- Runtime diagnosis: SVG HTTP 200 but Chromium texture upload fails with INVALID_VALUE. A controlled browser-only upload succeeds after adding explicit 960 by 640 root dimensions. Full repaired-application proof is required, not just the controlled result.
- Preserve original placeholder artwork and semantic links. No new illustration, panel design, external map, GPS, deployment, or publishing.
- Route: delegated direct; scene lifecycle, canvas integration, SVG assets, styling and browser tests need one bounded writer.
- Forecast: 140–260 new authored changed lines excluding generated outputs. Existing feature-branch-chain strategy remains; avoid unrelated changes or budget-driven code compression.
- [x] A3 Fix SVG dimensions, texture readiness/failure lifecycle, fallback visibility, and pointer marker detail navigation with observed RED/GREEN.
  - Planned surfaces: `src/scripts/map/scene.ts`, `src/components/MapCanvas.astro`, `src/styles/global.css`, `public/map/boom-2025/plan-base.svg`, `assets/map/boom-2025-plan.svg`, `tests/e2e/map.spec.ts`, and a focused new `tests/unit/map/scene.test.ts` if needed.
  - Acceptance: actual rendered plan has colored texture pixels rather than opaque black; load failure keeps the semantic fallback visible; ready is not published before texture success; clicking a marker opens its existing detail and Escape restores matching link focus; dragging or clicking empty canvas does not navigate; late load callbacks after teardown do not revive resources.
  - Tests must use a real screenshot/pixel or equivalent texture proof and actual pointer hit, not only a ready dataset or synthetic selection event.
- [ ] A4 Independently verify the repaired visual, pointer and failure paths, then follow the enabled native review consent for the new candidate.
  - Checks: `npm run check`, `npx vitest run`, `ASTRO_DEV_BACKGROUND=0 npx playwright test`, `npm run build`, `git diff --check`.
  - Normalization: no configured mutating formatter; normalize any required source changes before final tests and new candidate freeze.
- Pre-existing acknowledged focus/axe behavior must remain intact. Manual screen-reader evidence for original task 4.2 remains pending separately.
- Source at resume: branch `fix/interactive-map-accessibility`, previous implementation and `.atl` modifications unchanged. Preserve the user's existing Astro server; owned probes may use a distinct port and must clean up only their own processes. Astro may update ignored `.astro` cache state.
- New behavior is implemented: explicit SVG dimensions, readiness after textured render, error fallback, guarded late callbacks, and marker-hit detail navigation. Actual pointer drag/empty clicks do not navigate; Escape restores the POI link.
- TDD chronology: marker navigation and texture-error readiness failed before production edits. The initial pixel test falsely passed; the corrected texture-color assertion failed only in a post-fix negative control with dimensions removed. That control is not strict RED-first evidence for the texture fix.
- Earlier writer checks exposed seven TypeScript indexing errors and Escape/image-cache timing issues; corrected before final passing verification. No historical chronology is reconstructed.
- Fresh independent verification, first execution each: check zero diagnostics/31 files; unit 21/5 files; E2E 18 including 10 map tests; build 50 pages; diff check clean. Parent spot check passed all 10 map tests.
- Independent real-browser screenshot contains 63,112 plan-beige and 6,973 lake-blue pixels with the fallback hidden by production CSS; zero INVALID_VALUE/page errors. Diagnostic: `/tmp/opencode/map-repaired-independent.png`, not a committed test output dependency.
- Failed/delayed texture, disposal non-revival, real Kosmicare click/detail/Escape, drag, empty-click and previous focus/axe cases pass. No exhaustive GPU leak instrumentation or manual screen-reader proof is claimed.
- Follow-up implementation/test/asset diff is approximately 214 authored changed lines; initial focus/axe and task-document changes remain separate evidence. No new dependency was added. Existing large-chunk warning remains non-failing.
- Next step: new native candidate preflight/consent, then report outcome. No new native authority, legacy settlement, commit, push or PR is claimed yet; original task 4.2 remains pending genuine manual evidence.
