# Map First-Screen Usability

## Objective
Make the current independent map easier to discover and operate without changing its artwork, place data, or non-GPS claims.

## Problem and Why
The current homepage gives the safety notice substantial space, limits the map to 48rem, and places categories below the map. Markers lack an explanatory legend and camera gestures lack visible controls.

## Authorized Scope
- Responsive homepage composition: map and place/category panel side by side on desktop, stacked on mobile.
- Larger map area with a proportionate initial camera framing.
- Compact, still explicit unofficial/non-GPS and orientation-only notice on the homepage.
- Legend explaining the existing ordinary and highlighted care-landmark markers.
- Visible, keyboard-operable Zoom in, Zoom out, and Reset view buttons.
- Preserve semantic POI links, category page navigation, marker detail navigation, focus restoration, reduced motion, and static fallback.

## Constraints
- UI and technical artifacts remain English.
- No artwork, POI data, new category icons, hover/floating detail cards, search, routing, GPS, or synchronized in-place filtering.
- Preserve all existing dirty tracked/untracked work. The user explicitly authorized a local commit on October 4; pushing and PR creation remain unauthorized. Exclude generated output and unrelated changes from that commit.
- Existing branch: `fix/interactive-map-accessibility`.
- RDD status: on, deciding source default; candidate consent remains required when native review requests it.
- Strict TDD source: Engram observation #984; previous exception #1413 applies only to older Phases 2–3.
- Runner: `npx vitest run`; deterministic browser behavior uses `npx playwright test tests/e2e/map.spec.ts`.
- Observe RED before new runnable behavior, GREEN after implementation, and green checks after refactoring. Visual-only choices use browser structural/layout readback, not fabricated RED evidence.
- No formatter script is currently identified; finish any source-mutating normalization before native review.

## Plan and Route
- [x] U1: Implement responsive composition, legend, and camera controls with regression tests.
  - Route: delegated direct, one bounded writer.
  - Trigger: preparation for writing and five non-trivial files; parent does not accumulate implementation context.
  - Files: `src/pages/index.astro`, `src/components/MapCanvas.astro`, `src/scripts/map/scene.ts`, `src/styles/global.css`, `tests/e2e/map.spec.ts`.
  - Acceptance: categories are adjacent to the enlarged map; desktop/mobile fit without horizontal page overflow; notice remains explicit; legend matches marker semantics; controls change camera view and reset it; controls do not imply functionality in static fallback.
  - Proof: new deterministic Playwright assertions fail before implementation and pass afterward; all existing required checks pass.
  - Commit evidence: `aba1c20` — `feat(map): improve first-screen layout and camera controls`; includes related texture/focus prerequisites and tests, excludes unrelated registry edits and local tracking/generated files.
- [x] U2: Independently verify functionality and record the user's candidate-scoped review disposition without claiming native approval.
  - Route: delegated read-only verification if native tier requires it; parent structural readback and one reported command spot check.
  - Acceptance: record observed functional results and desktop/mobile browser screenshots; no invented accessibility or review verdict.
  - Proof: fresh functional checks, owned-browser probes, medium native assessment, validated candidate-scoped decline, and parent check. The old native correction lineage is unresolved, not approved or cleared.
  - Commit evidence: verification belongs to `aba1c20`; no application correction was made without an accessible finding.

## Checks
- `npx playwright test tests/e2e/map.spec.ts` — focused RED/GREEN.
- `npm run check` — Astro/TypeScript.
- `npm test` — full unit suite.
- `npm run test:e2e` — full Chromium browser suite including existing semantic/axe coverage.
- `npm run build` — static production build.
- Browser screenshots at desktop and narrow mobile dimensions; preserve placeholder/nonofficial disclosures.

## Delivery Strategy
`ask-on-risk`; initial forecast approximately 280–360 authored additions plus deletions, excluding pre-existing and generated files. The approximately 400-line budget is advisory, not a reason to omit tests or compress readable code. If the forecast materially exceeds that before delivery, ask once about slicing. No publishing is authorized.

## Progress and Evidence
- Read-only mapping completed; allowed files derived and current dirty state identified.
- Strict TDD observed: initial new assertions failed for absent legend/controls; final focused browser suite passed 11 tests.
- Parent screenshot readback found the original 48rem cap still active. A bounded correction added a quantitative width assertion: RED observed 768px against expected >850px; GREEN confirms the homepage map fills its larger column.
- Final writer verification: `npm run check` passed with zero diagnostics; `npm test` passed 21 tests; `npm run test:e2e` passed 19 tests including semantic/axe coverage; `npm run build` built 50 pages.
- Build emitted a non-blocking Vite chunk-size warning (>500 kB); no configured formatter or separate lint command was available.
- Desktop initial/reset and narrow-mobile screenshots: `test-results/map-homepage-map-is-framed-a24aa-d-and-working-view-controls-chromium/map-first-screen-*.png`.
- Actual increment approximately 424 authored additions plus deletions, excluding prior work. The explicitly authorized local commit includes 761 authored additions plus deletions with related prior prerequisites; no PR or publishing is prepared. Any later delivery slicing remains a separate decision.
- Initial native assessment was unassessable/high because untracked files require explicit inventory declaration; read-only native STATUS is the next step, not an inferred low-risk classification.
- Related source fixes were preserved and included in the authorized commit; unrelated `.atl/` modifications and local `odd/` / `test-results/` files remain outside it.
- User granted the native single-select review choice. The one reliability reviewer was admitted and returned `correction_required`; its exact `status_continuation` was executed without rebuilding tokens.
- Bound lineage: `review-9552e34450f08c43`; unchanged target: `sha256:84ec199e8ef064807a80a749c2b743e64a901a1b60b4bec322e8a38ae39b2810`.
- Native re-entry requests schema-bound intended-untracked selection before exposing the correction plan. The response names a schema but supplies no full value format; the prior guessed value was rejected with `invalid_request`, `mutation_outcome: not_started`.
- October 5 resume confirmed the same correction state and candidate. A bounded installed-documentation lookup could not recover the schema. No application correction, additional reviewer, commit, or authority reset was performed.
- Correction findings and allowed native correction scope remain unavailable; do not guess or substitute a new review transaction.
- User selected Continue without reporting. The exact captured decline invocation ran once and returned `action: declined`, `consent: declined_this_candidate`, and the expected target identity. No GitHub operations or review-mode changes occurred.
- The exact bound STATUS was re-entered afterward and still returned the inaccessible intended-untracked selection. The native correction lineage remains unresolved; no approval or authority reset is claimed.
- Fresh independent checks: Astro/TypeScript zero diagnostics, 21 unit tests passed, build produced 50 pages with the same non-blocking chunk warning. An owned Chromium/dist probe verified Zoom out, bounded zoom and exact PNG baseline restoration after zoom and pan; no deterministic functional bug was observed in those scenarios.
- Fresh full `npm run test:e2e`: 19 passed in 8.1 seconds, including semantic/axe coverage, using the repository's configured local server reuse. No manual screen-reader or cross-browser conformance claim is made.
- Local commit `aba1c20` succeeded with 11 source/dependency/test paths. No staging of generated/tracking files or unrelated registry changes, no push, and no PR.

## Next Step
Report the verified local commit and explicitly distinguish functional verification from the unresolved native finding. Await the next authorized map increment; do not automatically resume the old native lineage, report a defect, publish, or toggle RDD.
