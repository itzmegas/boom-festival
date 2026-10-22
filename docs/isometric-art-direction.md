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

Run `npm test`, `npm run build` and `npm run test:e2e`. Unit checks cover slab
separation, footprint, volume, batching and disposal. Browser checks cover visible
raised foliage and existing texture, selection, mobile gestures and fallbacks.
Inspect desktop and mobile screenshots as well as a zoomed-in view.

To remove this increment, remove the diorama import and scene attachment from
`scene.ts`, its module and its dedicated tests. The original map works unchanged.
Detailed venue artwork, geographic correction and pixel-art rendering remain
separate work; real-device GPU performance has not been measured.
