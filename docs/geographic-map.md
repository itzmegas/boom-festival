# Geographic context without invented POI locations

Choose **Geographic map** above the illustrated map to see the real Boom Festival
grounds and surroundings in OpenStreetMap. **Illustrated map** restores the
schematic, including its camera and selection. **View on map** always opens the
illustrated view because our curated POIs have no verified GPS coordinates.

## Source and boundaries

- The starting area comes from the [user-provided map](https://www.openstreetmap.org/#map=14/39.96258/-7.19201).
- OSM [way 172198778](https://www.openstreetmap.org/way/172198778) identifies the
  Boom Festival grounds. It does not establish an official entrance or routing.
- The embedded map covers longitude −7.23201 to −7.15201 and latitude 39.93758
  to 39.98758. No custom marker, GPS permission, routes or internal POIs are added.
- Category filters affect only the curated schematic places, not OSM's own data.

## Loading, attribution and fallback

The official OSM HTML embed avoids an extra mapping dependency. Its source is
assigned only when the visitor opens the geographic view; switching back and
forth preserves the embedded map instead of loading another copy.

The embed connects directly to OpenStreetMap and needs internet access. Attribution
and a direct external link remain visible even if the embedded map is blocked.
Without JavaScript, a normal link provides the same geographic destination.
The illustration and semantic place list remain independent of OSM availability.

Follow the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/):
keep attribution visible, allow the browser's normal caching and Referer, and do
not prefetch or offer offline downloads from the public tile service. Its
availability is best-effort, not guaranteed for festival-scale traffic.

## Verification

Run `npm test`, `npm run build` and `npm run test:e2e`. Dedicated browser tests
stub the external map rather than download public tiles. They cover on-demand
loading, switching, keyboard controls, mobile layout, enlarged text, queued
location actions, blocked embeds, WebGL unavailability and the no-JavaScript link. Verify the actual
provider separately; its map content and accessibility are outside our control.

Rollback: restore `MapCanvas` in `MapWorkspace.astro`, remove `MapViews.astro` and
the `map:show-illustrated` dispatch in `MapCanvas.astro`, then remove the dedicated
geographic-map tests and this document. The host resize observation in `scene.ts`
can remain: it also fixes loading recovery after a hidden map becomes visible.
No POI or geographic data migration is needed.
