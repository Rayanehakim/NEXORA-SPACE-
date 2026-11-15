# Task B Global Explorer

## Delivered

`GlobalExplorer` is exported from `frontend/src/features/explorer/index.tsx` and accepts the existing `ExplorerProps` contract. It has no router or mission-provider dependency. The app's Explorer page passes the catalog and mission callback into this lazily loaded module.

- Leaflet geographic map with OpenStreetMap raster tiles, visible attribution, zoom and metric scale controls.
- Keyboard-accessible markers and candidate buttons call `onSelectSite` with the exact catalog ID. Selection updates the mission context through the page adapter.
- Selecting a different site centers the map on that point. Fit candidates restores the filtered overview. Ordinary wheel scrolling does not zoom the map, keeping page scrolling predictable.
- Environment, name/country search and feature-data status filters update markers and the list together. Filters never silently change the mission. A message explains when the selection is hidden by filters.
- Candidate details show approximate coordinates, rationale, feature readiness, dataset-reference counts and terrain-asset availability without implying a validated analog score.
- Explicit unselected, empty catalog, no matches, invalid/out-of-map-range coordinates, loading, tile failure and map initialization failure states. The list remains usable without basemap access.
- Resize handling and StrictMode cleanup prevent duplicate maps. Custom styles are scoped to `.ex-explorer`; Leaflet's packaged stylesheet provides its standard map primitives.

## Dependencies

Runtime: `leaflet`. Development: `@types/leaflet`, `jsdom` for interaction tests. React and shared contracts are unchanged.

## Verification

`npm test` in frontend runs nine tests, including four new tests using the actual Leaflet module in jsdom. These exercise marker and list callback IDs, filter synchronization, hidden selection, empty catalogs, unsupported coordinates, readiness labels and StrictMode cleanup. Tests do not download tiles or establish visual browser rendering.

`npm run typecheck` and `npm run build` validate integration. Original Task D tests remain available through root `npm test`.

## Sources and network behavior

- Leaflet stable reference: https://leafletjs.com/reference-1.9.4.html
- OpenStreetMap attribution and license: https://www.openstreetmap.org/copyright
- Raster tile usage policy: https://operations.osmfoundation.org/policies/tiles/

Tiles use `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with browser caching, normal browser Referer behavior and no prefetch or offline-download feature. Standard browser headers must remain enabled when hosting. Basemap availability is best effort; a production deployment with heavier traffic may require another provider. Geography is orientation only and is not measured NASA terrain evidence.

## Limits

Basemap tiles require internet access. The current catalog has five pending candidates, so the Ready filter intentionally returns no matches. The Web Mercator basemap cannot display coordinates beyond about 85.05 degrees latitude; unsupported candidates stay accessible in the list. Current coordinates are catalog points, not validated study footprints. Both destination modes show the same unranked Earth catalog. Direct browser/mobile visual verification remains outstanding in this environment.

## Changed paths

Feature implementation and scoped CSS under `frontend/src/features/explorer/`; page integration in `frontend/src/app/Pages.tsx`; dependency manifests; `frontend/tests/explorer.test.mjs`; this handoff and the root project README. Simulator, mission contracts and scientific values are unchanged.
