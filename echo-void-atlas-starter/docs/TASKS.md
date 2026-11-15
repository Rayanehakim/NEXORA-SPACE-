# Module Assignments and Acceptance Tests

## Start in this order

1. **A0 short blocker**: starter repo + shared contracts + fixtures + running app. (This package supplies A0.)
2. **B/C/D/E/F in parallel** with fixtures. Do NOT wait for NASA data to build UI or math.
3. **Integration continuously**: feature builds against fixture in isolation; PR reviewed and merged into `integration`.
4. Replace fixtures with measured data **only when validated**. G verifies claims and submissions.

## A — Foundation / Integrator (large; central owner)

**Own:** `frontend/src/app/**`, `frontend/src/types/**`, `frontend/src/components/layout/**`, `frontend/src/styles/**`, `frontend/src/data/**`, `frontend/package.json`, `contracts/**`, root config.
**Deliver:** routing, persisted in-memory mission selection, integration adapters, mocks, app shell, consistent site IDs, CI/build, deployment. **Do not implement B–F's internals.**
**Acceptance:** `npm run typecheck && npm run build`; all routes load; choosing planet and site remains selected between routes; unavailable science is explicit.

## B — Global Explorer (medium)

**Own:** `frontend/src/features/explorer/**`. **Export:** `GlobalExplorer` from `index.tsx`.
**Inputs:** `ExplorerProps` (`sites`, `selectedSiteId`, `selectedPlanet`, `onSelectSite`). **Output:** selected `EarthSite.id` via callback. No API calls required.
**Deliver:** React Leaflet (or equivalent approved) map, markers, environment filters, list/cards, dataset availability, accessibility; use existing fixture.
**Acceptance:** Clicking a marker calls callback with its exact site ID. No site selected yields helpful state. All markers match props. No globally modified styles.

## C — Scientific Engine & Gap Analysis (medium-hard)

**Own:** `science/scoring/**`, `science/gaps/**`, `science/tests/**`. **Export:** Python CLI `python -m science.scoring.cli ...` (entry point to implement); JSON that conforms to `ComparisonResult` in TS and schema.
**Inputs:** a matched-scale pair of `FeatureSet` JSON files + mission profile; fixed weights/tolerances in versioned configuration.
**Deliver:** deterministic score, per-feature contribution, evidence status, validation, physical/planetary/evidence/operational analog gaps, reproducible tests.
**Acceptance:** identical valid features score 100; increasing difference cannot raise score; missing required feature results in score `null` and `INCOMPLETE_DATA`; no synthetic measured claims.
**Important:** C can begin with `frontend/src/data/fixtures/` sample schema, but don't edit it. Request updated examples through A.

## D — ECHO Drone (hard)

**Own:** `frontend/src/features/echo/**`. **Export:** `EchoSimulator` from `index.tsx`.
**Inputs:** `EchoProps` (`site`, `terrain`, `onMissionComplete`). **Output:** `SimulationReport` callback.
**Deliver:** controllable 3D drone, test terrain loader, scanning/coverage, pause-reset, altitude bounds, simulated stats; suitable for a short demo.
**Acceptance:** Works with procedural fixture; terrain site ID matches selected site; logs a simulated scan; reset clears state; no effect on science input values.
**Critical:** Must *not* create its own route/context/app shell. Optional dependency additions to A.

## E — Analysis / Gap UI + Report (medium)

**Own:** `frontend/src/features/analysis/**` and `frontend/src/features/report/**`. **Exports:** `AnalysisDashboard`, `MissionReport`.
**Inputs:** `AnalysisProps` (`target`, `site`, `comparison`), `ReportProps` (`target`, `site`, `comparison`, `simulation`).
**Deliver:** explainable score breakdown, per-feature source links, four gap categories, missing-data UI, print-friendly mission report; only render, do NOT compute new science values.
**Acceptance:** Both ready and incomplete data fixture states render; show `null` as unavailable not zero; simulated survey clearly labeled.

## F — NASA GIS and Terrain Data (hard; research-heavy)

**Own:** `science/gis/**`, `data/processed/**`, `data/sources/**`, `frontend/public/terrain/**` (assets only).
**Outputs:** real feature JSON respecting `FeatureSet`; georeferenced source metadata; `TerrainAsset` JSON for a specific Earth site.
**Deliver:** exact bounded Earth/Mars/Moon study windows; source registry; DEM conversion; comparable-scale mean slope, P90, roughness and relief; matched CRS/units; valid-pixel fraction; generated terrain asset.
**Acceptance:** Reproducible commands, no fabricated values, source URLs and versions, validate asset.siteId, valid resolution, no Earth EPSG applied to planetary data.
**Important:** raw planetary rasters can be huge; do not commit raw GB files. Start with one measured comparison.

## G — QA, Scientific Review, Submission (continuous)

**Own:** `docs/**` (coordinate edits), `tests/e2e/**`, `submission/**`.
**Deliver:** method, limitations, citations, smoke test, incognito-link test, AI-assisted code/data/media disclosures, 30-second demo storyboard and final NASA submission details.
**Acceptance:** End-to-end scenario works twice; no login; mobile and laptop fallback; public links work; measured data attributable; no invented 'NASA certified' claims.

## Handoff template (copy into every PR)

```md
### Module
### Owned paths changed
### Exports / input / output
### New dependencies (integrator must approve)
### Build/test commands and result
### How to test with fixtures
### Measured / simulated / unknown boundaries
### Known limitations and integration notes
```

## Merge policy

- Branch from `integration`: `feature/explorer`, `feature/science`, `feature/echo`, `feature/analysis-ui`, `feature/gis-data`.
- Contributor edits only owned paths. PR to `integration`, not `main`.
- Integrator checks scope, types, build, source attribution and navigation; merges one at a time; no direct branch-overwrite.
- Feature may be ready before real NASA data. A marks data availability and swaps in real JSON later.
- `main` contains proven demo versions only.
