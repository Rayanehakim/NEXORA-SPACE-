# NEXORA SPACE / ECHO-VOID ATLAS

React/Vite research prototype assembled from the supplied starter ZIP, with Task D integrated into main. Includes a planetary homepage, compact mission workflow, and destination-aware styling.

## Run on Windows

```powershell
cd echo-void-atlas-starter/frontend
npm install
npm run dev
```

From the repository root, `npm run dev`, `npm run typecheck`, `npm run build` and `npm test` are available after frontend dependency installation.

## Implemented

- Interactive Leaflet/OpenStreetMap explorer with five candidates, marker selection, search, environment and data-status filters.
- Shared planet, target, candidate and mission selection across routes.
- Evidence availability, four analog-gap categories, and explicit missing measurements.
- Original Task D 3D simulator integrated with mission results and reset handling.
- Printable report and JSON download.
- Versioned experimental Python scoring engine with analysis-plan validation, explainable contributions, four gap categories and 14 regression tests.

Run Python tests from `echo-void-atlas-starter` using `python -m unittest discover -s science/tests`.
CLI: `python -m science.scoring.cli EARTH.json TARGET.json --plan PLAN.json`. Install Python requirements from `science/scoring/requirements.txt`. See `science/scoring/README.md` for synthetic examples and scientific limits.

## Evidence boundary

No measured NASA rasters were supplied. No measured comparison, scientific ranking, or NASA-certified threshold is claimed. The geographic basemap is for orientation; candidate coordinates are approximate and basemap tiles require internet access. Simulator terrain is procedural and not representative of the selected site's measured geometry. The scoring configuration is illustrative and is not connected to frontend rankings. Real analysis requires validated source metadata, matched footprints, scale and processing. GIS extraction and a scientifically validated measured comparison remain outstanding.

Task D originals are retained at `src/components/EchoDroneSimulator.jsx` and `tests/test.mjs`. The frontend integrates that component with a terrain adapter and explicit procedural-source labelling. The original ZIP and conversation remain intact.
