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

All ten Earth/planet pairs now have locally reproduced terrain QA from the supplied NASADEM, Copernicus, ArcticDEM, REMA, MOLA and LOLA files. The current trials share 5 km footprints, 500 m cells and 1500 m roughness windows, with five processing scenarios each. Analysis and Report select the exact matching evidence and retain it in JSON exports. Earlier unequal-footprint snapshots remain historical records and are superseded in the UI.

Run `python -m science.gis.local_catalog` with the original inputs at repository root to reproduce the complete catalog. Source identities, archive/label hashes, baseline features, scenario outputs and processing versions are tracked under `data/evidence/local-catalog/`. See [all-combinations handoff](docs/ALL_COMBINATIONS_HANDOFF.md).

All twenty station/target/objective selections show Python-computed **provisional model indices**. Regenerate the bundled results with `python -m science.gis.export_experimental`; CI checks them against tracked baseline inputs. Independent source authenticity, study-window suitability and scientific review remain pending. No scientifically approved comparison or measured drone terrain is published. ECHO uses labelled procedural demonstration geometry; its observations are simulated. Scientific model settings are experimental project choices, not NASA safety limits or success probabilities.

`npm run build` checks the review ledger before compiling. Copying an unreviewed comparison or DEM into the public directory blocks the build. See `data/evidence/README.md` before releasing quantitative artifacts.

## Deployment and remaining work

See `docs/DEPLOYMENT.md` for build paths, SPA deep links, staging checks and the distinction between a provisional prototype and a reviewed scoring release. No deployment is performed by the build workflow. Human browser/WebGL/print verification, source-data review and final competition submission remain separate gates.
