# Move the schematic toward an isometric diorama

The first visual increment adds real volume to the existing map: a raised terrain
edge, faceted trees, tent rows, stage canopies and small pavilions. It takes spatial
readability from [Isometric NYC](https://cannoneyed.com/isometric-nyc/), not its
artwork or city data. This is a first step, not a reproduction of its pixel-art detail.

## What stays stable

- The original SVG remains the ground texture and the non-WebGL fallback.
- Decorative scenery stays in place when category filters change the markers.
- POI coordinates, selection, View on map, pan, pinch and reset are unchanged.
- The scene still renders only on demand; there are no animated objects.

## Rendering boundaries

`src/scripts/map/diorama.ts` contains original, illustrative scenery authored in
the SVG's 960 × 640 coordinate space. It adds no dependencies or remote assets.
Trees and tents use instancing; geometry, materials and instance buffers share
the existing disposal registry. Directional lighting shades the low-poly faces;
flat contact shadows avoid the extra cost of real-time shadow maps.

The ground slab ends below the SVG plane so it cannot obscure the lake or paths.
The diorama is decorative: markers and the semantic list remain the interactive
interface. These shapes do not claim surveyed locations or actual architecture.

## Verification and rollback

### Dance Temple pilot

Dance Temple now has a radial, open-centred fabric canopy with a scalloped edge,
warm/purple panels and forked wooden supports, rather than a generic cone.
Its anchor matches the existing POI; no place coordinates or interactions changed.
The SVG adds a courtyard, connecting paths and six matching trees, so non-WebGL
visitors also see the improved ground layout. Other venues remain schematic.

The visual reference is the radial fabric and branching columns in
[Filipe Patrocínio's official 2025 gallery](https://www.boomfestival.org/gallery/2025/boom-2025-filipe-patrocinio),
particularly `bf_25_filipe_patrocinio47.jpg`. The geometry is an independent
interpretation, not a reconstruction. No reference photographs are shipped.
The local official-map reference establishes context, not surveyed coordinates.

`dance-temple.ts` owns the landmark. Its supports are instanced, its fabric is a
single two-sided mesh, and every GPU resource uses the existing disposal registry.
Remove that module and its attachment in `diorama.ts` to revert only the landmark;
the SVG ground improvements can remain independently.

### Alchemy Circle

Alchemy Circle replaces its generic cone with an open-ended timber vault:
nine instanced arches and separated teal, sand and copper fabric strips.
The SVG includes a matching pavilion footprint, courtyard, connecting paths,
four trees and a label. Its existing POI anchor and all interactions stay unchanged;
Dance Temple and the remaining generic stage IDs and colors are preserved.

This is original illustrative architecture, not a verified replica of the 2025
venue. The current [official Alchemy Circle page](https://www.boomfestival.org/programme/alchemy-circle)
describes a biomimetic wooden structure but now refers to 2027; it is not evidence
for the exact 2025 design. No external artwork or photographs are shipped.

`alchemy-circle.ts` owns the pavilion and registers all GPU resources for disposal.
To roll back only this venue, remove its attachment/module and restore generic
stage 1 at `(403, 243)` with terracotta canvas; its SVG ground can remain independently.

### Checks

Run `npm test`, `npm run build` and `npm run test:e2e`. Unit checks cover slab
separation, footprint, volume, landmark anchoring, canopy opening, batching and disposal.
Browser checks cover visible raised foliage and existing texture, landmark selection,
mobile gestures and fallbacks.
Inspect desktop and mobile screenshots as well as a zoomed-in view.

To remove this increment, remove the diorama import and scene attachment from
`scene.ts`, its module and its dedicated tests. The original map works unchanged.
Additional venue artwork, geographic correction and pixel-art rendering remain
separate work; real-device GPU performance has not been measured.
