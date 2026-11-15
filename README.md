# NEXORA SPACE — ECHO VOID ATLAS

Research prototype for selecting Earth candidates, inspecting provisional planetary terrain evidence, and rehearsing Earth-based drone reconnaissance. Similarity scores remain unavailable until a reviewed measured comparison is released. The original root drone source and tests are retained.

## Canonical layout

There is one application: `frontend/`, with `science/`, `contracts/`, `data/`, `docs/` and `submission/` at repository root. The duplicate `echo-void-atlas-starter/` source tree has been retired; it remains in Git history. Root commands and GitHub Actions now target these canonical folders.

## Run on Windows

Use Node 22.13 or newer (Node 24 is suitable):

```powershell
npm --prefix frontend ci
npm run dev
```

Open the printed localhost URL. Root commands: `npm test`, `npm run typecheck`, `npm run build`. Static output is `frontend/dist`. Keep the whole repository available during build; the frontend's prebuild uses the shared release checker.

For scientific processing, use a separate environment:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r science/gis/requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s science/tests -v
.\.venv\Scripts\python.exe -m unittest discover -s science/gis/tests -v
.\.venv\Scripts\python.exe scripts/validate_contracts.py
```

## Implemented

- Planetary homepage; Mars/Moon selection and compact shared mission settings.
- Interactive geographic Explorer with exact-ID selection, search and filters.
- Experimental Python terrain scoring and gap analysis, with missing-data gates.
- GIS preparation, descriptor extraction, native MOLA count QA and site-specific resampling sensitivity tools.
- Analysis/report modules with loading, missing, invalid and network-error states, consistent JSON export and printable evidence.
- ECHO terrain validation, simulated scanning and completed mission reports. The viewport remains 480 pixels high.
- Reviewed-artifact publication checks and CI covering both frontend and GIS/scoring code.

## Evidence boundaries

The Erfoud–Jezero and Atacama–Jezero QA values are prior provisional snapshots. Original source-label verification, complete processing artifacts and independent reproduction are still pending. Neither snapshot is approved for similarity scoring. Source references are tracked in `data/sources/catalog-task-f.json`; missing evidence is recorded under `data/evidence/`.

No reviewed comparison or measured drone terrain is currently published. ECHO uses the same labelled procedural demonstration geometry for each selected site's mission. Scientific model settings are experimental project choices, not NASA safety limits or mission success probabilities.

`npm run build` checks the review ledger before compiling. Copying an unreviewed comparison or DEM into the public directory blocks the build. See `data/evidence/README.md` before releasing quantitative artifacts.

## Deployment and remaining work

See `docs/DEPLOYMENT.md` for build paths, SPA deep links, staging checks and the distinction between a provisional prototype and a reviewed scoring release. No deployment is performed by the build workflow. Human browser/WebGL/print verification, source-data review and final competition submission remain separate gates.
