# Mobile map experience: acceptance and verification

Status: implemented following the user's separate authorization. Checked criteria record implementation and automated verification, not physical-device or full accessibility sign-off. iOS Safari and Android Chrome hardware validation remains pending.

Keep the complete plan visible on entry, give visitors an explicit way to locate a place without opening its detail, and support two-finger zoom without accidental selection. Preserve the existing map/list layout, semantic navigation, static fallback, and unofficial/non-GPS disclosures.

## Starting baseline (before this increment)

- `src/scripts/map/scene.ts` starts and resets at distance 14. Resize updates projection but does not compute a new overview. Camera distance is bounded to 9–18; target bounds cover only the middle of the plan.
- `src/styles/global.css` uses a 16:10 canvas on desktop and 3:2 at widths up to 760px. Mobile already stacks map and list, with the place preview below the canvas.
- `poi:select` highlights a marker and previews a place; it does not center the camera. `PoiList.astro` links open details; `PoiDetail.astro` has no dedicated map-location action.
- Pointer handlers accept only the primary pointer. The canvas already reserves touch input with `touch-action: none`; there is no two-finger zoom handling.
- `tests/e2e/map.spec.ts` computes marker positions using a hardcoded distance of 14. It must change with responsive camera framing rather than silently testing old coordinates.

## 1. Responsive framing

**Implemented:** keep the existing layout and aspect ratios. Calculate the closest overview that contains the complete projected plan inside the usable canvas, rather than choosing a distance from a mobile breakpoint alone. Keep the fixed camera angles. Recalculate valid camera bounds together with overview and place focus.

Tradeoff: a complete overview makes small mobile labels less readable than a cropped close-up. Explicit place focus and zoom provide detail without hiding part of the venue on entry.

- [x] **R1 — Entry:** on home and category maps, all four projected plan corners fit with at least 16 CSS px of edge clearance. Reserve the actual control footprint so controls do not cover the plan or its edge markers in overview.
- [x] **R2 — Layout:** at 320, 360, 390, 430, 760, 761, and 1440 CSS px widths, no horizontal page overflow occurs; controls remain fully visible and at least 44×44 CSS px. Mobile preview remains outside the canvas and names can wrap.
- [x] **R3 — Reset:** after pan, zoom, or place focus, Reset view restores the computed overview for the current canvas size, not the old fixed distance. Reset preserves the selected place and its preview.
- [x] **R4 — Resize:** an untouched/reset overview refits after resize or orientation change. An explored view preserves its target and zoom factor relative to overview, subject to valid bounds; a focused place remains visible. No resize silently clears selection.
- [x] **R5 — Limits:** the overview is always reachable and every published marker can be brought into the unobscured viewing area, including edge places. Repeated zoom, pan, and reset remain finite and bounded. A zero-sized/hidden canvas does not corrupt state and refits when visible.

## 2. Explicit “View on map” action

**Implemented:** add a separate action beside each place link in map workspaces and on details belonging to the current mapped edition. The UI remains English: **View on map**, with an accessible name identifying the place. Never nest this action inside the existing detail link.

- [x] **V1 — Separate intent:** the existing place link still opens its detail. Focus/hover can preview or highlight, but does not pan, scroll, or navigate. Only explicit View on map requests camera focus.
- [x] **V2 — Locate:** activation selects the correct place, centers its marker in the usable map area, and shows the existing named preview. Preserve the current zoom, bounded as needed; do not add an arbitrary close-up preset. Scroll the map into view and place keyboard focus on the named preview region without causing a second scroll back to the list.
- [x] **V3 — Category context:** locating a listed place on a category map keeps that category and its visible set. The selected marker, preview, and matching semantic list entry agree. Repeated activation is safe and does not open the detail.
- [x] **V4 — Detail/deep link:** the detail action reaches the current-edition map with the place identified in the URL. Direct entry/reload works without session storage. If scene/texture loading is delayed, retain only the latest explicit request and apply it once ready. An unknown or filtered-out place leaves a usable overview/list without throwing or selecting another place.
- [x] **V5 — Edition boundary:** never send a historical place to the current-edition map as if it belonged there. Details and edition-only lists without a matching map do not offer this enhancement. Adding historical map routes is outside this increment.
- [x] **V6 — Accessible fallback:** actions are real, keyboard-operable links with a semantic list-entry destination when JavaScript or WebGL is unavailable. Keep the static plan, normal detail links, and accessible place information; do not claim successful interactive centering in fallback. Storage denial must not break navigation.
- [x] **V7 — Motion and return:** reduced-motion mode uses direct camera/scroll updates. Existing Escape, preview dismissal, and return-focus behavior remain intact. Closing a preview does not reset the camera or reopen a detail.

Implementation boundary: reuse the shared place identity and selection state, but keep explicit camera-focus intent separate from ordinary `poi:select`. Do not make every list-focus event move the camera. No global store or new routing dependency is needed.

## 3. Two-finger zoom

**Implemented:** retain one-finger pan and tap-to-preview. With two touch pointers on the canvas, spreading fingers zooms in and bringing them together zooms out. Anchor the gesture to the plan point under the fingers' midpoint; do not rotate or tilt the camera.

- [x] **P1 — Continuous zoom:** pointer separation controls zoom proportionally to the gesture's starting separation, independent of event count. It shares limits with the existing zoom buttons; minimum separation, coincident fingers, and repeated gestures never produce invalid camera values.
- [x] **P2 — Anchor:** away from camera bounds, the starting plan point tracks the moving midpoint within 4 CSS px. At bounds, camera safety takes precedence over exact anchoring, without abrupt jumps. If the midpoint starts outside the plan, use the underlying plan plane as the anchor rather than changing selection.
- [x] **P3 — No accidental activation:** a gesture that ever has two active fingers cannot select a marker, clear selection, open a preview for another place, or navigate when either finger lifts. Suppress tap recognition until all pointers from that gesture have ended.
- [x] **P4 — Transitions:** adding a second finger cancels pending tap recognition. Returning to one finger rebases pan at the remaining finger's position without a jump. Ignore additional fingers for camera updates until the gesture ends; cancellation/lost capture, page hide, or disposal clears pointer state and permits the next gesture normally.
- [x] **P5 — Gesture ownership:** gestures on the ready canvas manipulate the map, not page zoom/scroll. Outside the canvas, native page scrolling and browser zoom remain available. Mobile visitors can scroll past the map using surrounding content; fallback/loading canvases do not capture gestures.
- [x] **P6 — Alternatives and regressions:** Zoom in, Zoom out, and Reset view remain keyboard-operable and usable without multitouch. Mouse hover/click, wheel zoom, slow drag, single-touch preview, and explicit detail navigation keep working. No continuous idle render loop is introduced.

## Implementation slices

| Order | Scope and files | Required evidence |
| --- | --- | --- |
| 1 | Overview and camera limits: `src/scripts/map/camera-controls.ts`, `scene.ts`; layout adjustments in `src/styles/global.css` only if required | R1–R5; unit tests for fit/bounds/resize; update E2E marker projection assumptions |
| 2 | Explicit locate intent and deep-link lifecycle: `selection.ts`, `scene.ts`, `MapCanvas.astro`, `MapWorkspace.astro`, `PoiList.astro`, `PoiDetail.astro`, and detail route as needed | V1–V7; list/detail/category journeys, delayed readiness, invalid requests, storage denial, and fallback |
| 3 | Pointer lifecycle and anchored zoom: `scene.ts`, shared camera math where necessary, map guidance in `MapCanvas.astro` | P1–P6; deterministic two-pointer tests plus real-device confirmation |

Keep tests with their slice. Do not change artwork, POI coordinates, content schemas, exports, or dependencies for this work. Review all `PoiList` callers, including edition-only lists, before adding actions. Changes to global styles must not leak into detail or edition pages.

## Verification coverage

| Check | Coverage |
| --- | --- |
| Unit tests in `tests/unit/map/camera-controls.test.ts` and focused gesture tests where appropriate | Projected-corner containment across aspect ratios, dynamic limits, relative zoom on resize, edge-place focus, finite zoom math, gesture transitions/cancellation |
| Browser tests in `tests/e2e/mobile-map.spec.ts`, `tests/e2e/map-gestures.spec.ts`, `tests/e2e/map.spec.ts`, and existing semantic coverage | R1–R5 layout at listed widths; V1–V7 keyboard/touch/deep-link journeys; P1–P6 true two-pointer sequences, not only synthetic wheel input |
| Short landscape (844×390), portrait (390×844), and text/page zoom checks | Controls reachable, no preview overlap, no horizontal document overflow, surrounding page scroll remains usable |
| Pending: real iOS Safari and Android Chrome | Two-finger anchoring, one/two/one transitions, interrupted gestures, native scrolling/zoom outside canvas, orientation change; emulation alone is not device sign-off |
| `npm run check`, `npm test`, `npm run test:e2e`, `npm run build` | Existing semantic/axe checks, static output, fallback, reduced motion, and idle-render regressions |

New behavior followed RED/GREEN: overview tests failed before the camera helpers existed; action journeys failed before links existed; six pinch unit cases and three native touch-injection cases failed before gesture support. Additional integration tests exposed and now cover queued requests on texture failure and enlarged-heading overflow.

### Verified on October 21, 2026

| Command or observation | Result |
| --- | --- |
| `npm run check` | Final check: zero errors, warnings, or hints |
| `npm test` | 34 tests passed across 5 files |
| `npm run test:e2e -- --workers=2` | 39 Chromium tests passed, including existing semantic/axe coverage |
| `npm run build` | Check passed; 50 static pages built; existing >500 kB chunk warning remains |
| Built `dist/` smoke check | Owned loopback static server and Chromium: deep link, ready texture, preview focus and native two-pointer zoom passed with zero page errors; server/browser closed afterward |
| Layout | 320/360/390/430/760/761/1440px widths; 390×844 and 844×390 rotation; hidden/revealed canvas and 200% root text size |
| Touch | Chromium mobile emulation with native two-pointer input: proportional zoom, <4px moving-midpoint anchoring, shared limits, extra fingers, rebase, cancellation and capture loss; native page scroll/zoom outside canvas |
| Navigation | Category-preserving explicit focus, detail/reload links without storage, latest queued request, invalid/filtered requests, no-JS/WebGL and failed-texture fallback |

Camera zoom limits are 0.35–1.5 times the computed overview distance. The overview reserves the measured control strip plus marker clearance; explicit focus also avoids the desktop preview. Actions use `?poi=<slug>#poi-<slug>` so the URL contains the intent while the fragment remains a real semantic fallback target. Selection alone never moves the camera.

The implementation touches only map camera/scene logic, existing place/map components, scoped styles, tests, and this document. Artwork, POI data, schemas, dependencies, and unrelated dirty files were preserved. No commits, pushes, or PRs were created.

## Scope boundary and next step

No fullscreen mode, inertial gestures, camera rotation, search, GPS, routing, new map library, persistent camera storage, historical map expansion, artwork changes, or localization was added in the original mobile increment.

## Follow-up: marker visibility and rotation

- **Show markers** toggles all place icons without changing filters, selection or
  artwork. Hidden icons cannot be hovered or activated; the semantic list remains
  available. **View on map** reveals them and exits rotation mode before locating.
- **Rotate map** switches single-pointer dragging from pan to orbit, including
  one-finger touch. Arrow keys on that button also rotate. Horizontal rotation
  wraps through 360°; tilt stays between 15° and 89.9° to avoid the underside and
  the camera pole. Disable the mode to pan or tap markers again.
- Pinch and wheel zoom keep working at the current angle. Resize preserves the
  orientation; **Reset** restores the default angle and responsive overview and
  exits rotation mode, without changing marker visibility.
- Both toggles expose `aria-pressed` and remain disabled when WebGL is unavailable.
  No camera or visibility preferences are persisted across navigation.

Checks: `tests/unit/map/camera-controls.test.ts` covers rotated projection,
anchoring and angle limits; `tests/e2e/map-display-options.spec.ts` covers hidden
marker rendering/hit testing, explicit reveal, mouse/touch/keyboard rotation,
rotated pan/pinch, resize and reset. Real-device performance remains unmeasured.

Next step: validate interaction feel and bounds on real iOS Safari and Android Chrome before device sign-off. Manual screen-reader testing is also not claimed; automated axe results are not proof of full WCAG conformance. The full overview deliberately prioritizes showing the complete plan over avoiding all marker overlap; explicit focus and zoom provide detail.
