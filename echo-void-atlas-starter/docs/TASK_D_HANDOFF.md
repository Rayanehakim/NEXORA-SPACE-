# Task D ECHO terrain and mission integration

## Delivered

`EchoSimulator` is exported from `frontend/src/features/echo/index.tsx`. Its required props follow the shared `EchoProps`: selected Earth site, `TerrainAsset`, and completed `SimulationReport` callback. An optional `onMissionReset` callback lets the app clear a previously recorded report on reset or unsuccessful outcome.

The existing flight renderer, controls, pause/reset, altitude bounds, battery model and survey algorithm are retained. The viewport remains 480 pixels high. The original root `src/components/EchoDroneSimulator.jsx` and `tests/test.mjs` were not changed.

## Terrain path

The app adapter looks up the selected site's `terrainAssetUrl`. If none exists, it provides the same deterministic 49 by 49 procedural landscape as before, wrapped in the shared TerrainAsset contract and associated with that mission's site ID. Selecting another site changes the mission identity, not the demonstration landscape into a measured one.

If an asset URL exists, the adapter fetches its JSON with loading, cancellation, failure and retry handling. It validates the exact selected site ID, source type, version, finite grid, dimensions from 2 to 256, positive metre spacing and required DEM source reference. Failed or mismatched imports do not silently load demonstration terrain. Late fetches cannot overwrite a different site's session.

`toDroneTerrain` translates the contract grid into the existing drone DEM format without changing its elevations or horizontal spacing. Its procedural provenance carries `SIMULATED`; DEM-derived geometry carries its source ID. The frontend runtime renderer has two small changes: a terrain prop type annotation and recognition of the explicit simulation label. Its core flight calculations and viewport are unchanged.

The current TerrainAsset contract only accepts finite numeric cells. Terrain with no-data cells must be handled by a future compatible contract/data-pipeline change; the renderer's standalone legacy DEM format can handle null cells, but this adapter does not invent values to fill them.

## Mission reports

A session recorder collects unique scan sequence IDs and finite positions. Synchronous event collection preserves the final observation if scanning and survey completion fire in the same frame. A completed report snapshots observations and records the Earth site, actual terrain version, unique mission ID, coverage and distance. All reports remain `simulated: true`, including flights over DEM-derived terrain.

Aborted, low-battery and invalid summaries do not become completed reports. Reset clears observations and the parent report. Switching site, target or objective retains the existing app behavior of starting a fresh simulator session.

## Validation

Six new frontend tests cover terrain identity and validation, terrain conversion and labels, observation snapshots, invalid/aborted outcomes, same-frame scan retention, reset and mismatched-site rejection. Tests use the actual recorder and conversion code, a DOM-mounted EchoSimulator with a lightweight renderer substitute, and the runtime renderer's pure DEM core. The original drone core tests also pass.

Run from repository root:

```powershell
npm test
npm run typecheck
npm run build
npm run dev
```

Visual WebGL interaction still needs a real-browser smoke test. The existing coarse-DEM slope checks and battery settings are illustrative engineering behavior, not certified flight or obstacle safety limits.

## Changed paths and dependencies

- `frontend/src/features/echo/`: public component, terrain conversion/validation and session recorder.
- `frontend/src/app/DroneAdapter.tsx`: selected-site lookup and terrain loading.
- `frontend/src/app/Pages.tsx`: terrain-neutral simulation disclosure.
- `frontend/src/components/EchoDroneSimulator.jsx`: explicit source label and prop annotation only.
- `frontend/tests/echo.test.mjs`: integration and regression checks.
- Project README and handoff documentation.

No new dependencies or shared contract changes were required. No NASA DEM has been added. GIS work must supply validated terrain files and source registry entries; this integration is ready to receive them.
