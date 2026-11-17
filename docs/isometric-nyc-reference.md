# Isometric NYC: lessons for Boom

**Recommendation:** adopt the visual-production and quality-review lessons, not
the entire NYC stack. First compare one small original-art pilot with our current
diorama. No renderer migration, model training, or external service is approved
by this analysis.

## Sources and scope

Reviewed on 2026-11-17:

- [Official repository](https://github.com/cannoneyed/isometric-nyc).
- [Creator's process article](https://cannoneyed.com/projects/isometric-nyc).
- Repository documentation at commit
  [`008446357ec67512c4329d25edefb6c508c7b24d`](https://github.com/cannoneyed/isometric-nyc/tree/008446357ec67512c4329d25edefb6c508c7b24d):
  [README](https://github.com/cannoneyed/isometric-nyc/blob/008446357ec67512c4329d25edefb6c508c7b24d/README.md),
  [viewer](https://github.com/cannoneyed/isometric-nyc/blob/008446357ec67512c4329d25edefb6c508c7b24d/docs/app.md),
  [generation](https://github.com/cannoneyed/isometric-nyc/blob/008446357ec67512c4329d25edefb6c508c7b24d/docs/generation.md),
  and [data/models](https://github.com/cannoneyed/isometric-nyc/blob/008446357ec67512c4329d25edefb6c508c7b24d/docs/data.md).

This is a documentation-based architectural comparison, not an upstream source
audit or a reproduction of its results. The article describes the author's
experience; its model quality, throughput, and costs are not independently
verified or current price estimates.

## The important difference: artwork versus renderer

NYC's final experience explores **pregenerated isometric raster artwork** through
a tiled-image viewer. Its Three.js renderer helps produce source images; it is
not the same thing as rendering the final city geometry live for visitors.

Our map renders **illustrative 3D scenery over a schematic SVG** in the browser.
Changing the camera or viewer alone will not create NYC's pixel-art detail.
Conversely, baking artwork into an isometric image would not preserve arbitrary
3D rotation automatically: geometry, markers, and hit targets would need a
consistent projection.

Local evidence:

- [`isometric-art-direction.md`](isometric-art-direction.md): original scenery,
  stable SVG fallback, instancing, on-demand rendering, and current landmark work.
- [`scene.ts`](../src/scripts/map/scene.ts): perspective camera, textured plan,
  diorama attachment, separate interactive markers.
- [`diorama.ts`](../src/scripts/map/diorama.ts) and
  [`projection.ts`](../src/scripts/map/projection.ts): illustrative placements
  anchored to the plan, not a surveyed 3D reconstruction.
- [`geographic-map.md`](geographic-map.md): geographic context is distinct from
  curated POIs without verified GPS coordinates.

## How NYC was made

| Stage | What the sources describe | Lesson for Boom |
| --- | --- | --- |
| Source geometry | CityGML plus satellite imagery produced alignment problems; the author switched to textured Google Maps 3D tiles rendered orthographically. | Agree on geometry, scale, and projection before styling. A prettier image cannot repair uncertain coordinates. |
| Art direction | Nano Banana produced initial render-to-art pairs but inconsistent style and expensive generation at city scale. | Prove a style on a small representative area; do not assume one successful image scales. |
| Fine-tuning | The article reports roughly 40 pairs for an initial Qwen/Image-Edit experiment. Repository docs describe later datasets with water, trees, and terrain. | Training is a possible production optimization, not a prerequisite for our smaller map. |
| Seam control | Masked infill extends existing artwork. The article describes 1024×1024 generations composed of 512×512 quadrants. | Independently generated adjacent images are not automatically seamless. Preserve shared context and inspect joins. |
| Authoring state | SQLite tracks quadrants and metadata; a generation app selects areas and plans work. | Keep source, placement, generation settings, and approval state recoverable if generated assets are introduced. A new database is not needed yet. |
| Quality repair | Water, trees, and seams required substantial manual review; export/import enabled external image editing. | Budget human cleanup and retain editable originals. Automated image review is not proven sufficient by this project. |
| Scaling | The article describes moving from Oxen to rented H100 inference; repository generation docs also describe Modal, Oxen, and Nano Banana sources. | These are different documented stages/options, not a single reproducible deployment recipe. Avoid GPU infrastructure before measuring our own workload. |
| Delivery | Viewer docs describe React/OpenSeadragon and a DZI image pyramid exported using libvips, including WebP output. | Tiled delivery is useful for genuinely large raster artwork, not automatically for a small live 3D scene. |

The article initially estimates around 40,000 tiles; repository data docs describe
around 32,000 generated quadrants. These are differently framed estimates/stages,
not a measured asset requirement for Boom.

## What to use, defer, or avoid

| Idea | Recommendation | Tradeoff or trigger |
| --- | --- | --- |
| Consistent silhouettes, palette, scale, and readable landmarks | Use now as review criteria for original Boom artwork. | Visual consistency requires art direction, not just more polygons. |
| Small-area iteration and manual QA | Use now. Compare overview, close-up, and mobile views. | More deliberate review, less wasted large-scale production. |
| Focused authoring tools | Add only when a repeated editing problem is observed. | Start with the existing workflow; no general-purpose editor yet. |
| Generated textures or sprite assets | Consider a bounded experiment. | Could increase detail, but introduces provenance, style consistency, transparency, and cleanup work. |
| Masked multi-tile generation | Defer until a raster pilot actually requires adjoining tiles. | Useful seam strategy, but ordering and corrections complicate production. |
| OpenSeadragon/DZI | Defer unless a large fixed-view raster map becomes the chosen product. | Efficient deep zoom, but not a drop-in replacement for our rotating diorama. |
| CityGML/Google 3D input | Do not adopt as a default. | Need suitable festival coverage, event-specific structures, verified alignment, and acceptable usage terms first. |
| Qwen fine-tuning and GPU queues | Do not adopt now. | Unmeasured benefit at our scale; introduces cost and operational work. |
| NYC artwork, tiles, or production endpoints | Do not incorporate into Boom. | Wrong subject matter and separate asset/service rights; keep our artwork independent. |

## Proposed next experiment — not yet implemented

Use one small area containing a path, vegetation, and a lake edge. This exposes
the same types of texture and boundary problems the author encountered without
redesigning a landmark or the whole map.

1. Capture the current diorama as the baseline.
2. Define a short style sheet: palette, detail level, tree silhouettes, scale,
   and lighting direction. Keep existing POI anchors and schematic status explicit.
3. Produce one original-art candidate. If generative tools are chosen, first
   confirm source rights, provider, and spending limit; retain input and settings.
4. Compare at overview and close-up on desktop and mobile: landmark/path
   legibility, consistent scale, water/tree quality, visible boundaries,
   interaction alignment, image weight, and editing time.
5. Choose whether to continue improving procedural 3D, selectively add baked
   assets, or separately investigate a fixed-view raster approach.

Reject the candidate if extra detail obscures paths or markers, breaks rotation
or fallback expectations, or requires disproportionate cleanup. Expand only after
the visual gain and production effort are understood. Actual device performance
and any numeric budgets still need measurement; this analysis supplies no benchmark.

## Reuse and unresolved constraints

The repository advertises an
[MIT license](https://github.com/cannoneyed/isometric-nyc/blob/008446357ec67512c4329d25edefb6c508c7b24d/LICENSE).
For any code reuse, inspect applicability and preserve required notices.
Do not infer that every dataset, image, model weight, or third-party map input
shares that permission. Public access to tiles or an API is not a reuse grant.
Google-derived rendering, derived/generated outputs, storage, training, and
attribution would each need a terms review before that route is selected.

No upstream application was installed or executed. No current API compatibility,
service availability, billing, dataset completeness, or asset rights were tested.
The upstream generation guide contains an unfinished rule description, and its
README explicitly warns about rough edges; neither should be treated as a complete
specification to transplant.

**Next decision:** whether a small art-direction pilot is worth doing while
retaining the current interactive architecture. No full-map migration is needed
to answer that question.
