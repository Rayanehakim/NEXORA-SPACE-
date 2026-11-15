# First Prompts for Separate Vibecoding Tools

Before any prompt, paste or reference `docs/AI_HANDOFF.md`, `docs/TASKS.md`, `docs/DECISIONS.md`, and `frontend/src/types/contracts.ts`.

### Task B — World Explorer

> Implement only Task B in `frontend/src/features/explorer`. Export a reusable `GlobalExplorer` accepting `ExplorerProps` from the shared contracts. Use the provided sites fixture. Implement a polished, accessible interactive Leaflet map, cards, filters and selection callback. Do not create your own app/router/context or change packages. Show candidate rationale and data availability, not fabricated similarity scores. Include an isolated fixture-based test/handoff.

### Task C — Scientific scoring & analog gaps

> Implement only Task C in `science/scoring`, `science/gaps` and tests. Accept two `FeatureSet` JSONs plus mission profile and output an exact `ComparisonResult`. Deterministic scoring, documented fixed weights/tolerances, required-feature check returning `INCOMPLETE_DATA`, per-feature contributions and four categorized gaps with evidence types. Write pytest unit tests. Never claim algorithmic scores are probabilities or fabricate NASA data. CLI and handoff docs required.

### Task D — ECHO drone

> Implement only Task D in `frontend/src/features/echo`. Export `EchoSimulator` with exact `EchoProps`. Render provided `TerrainAsset` using React Three Fiber and Three.js; build manual keyboard controls, altitude/world boundaries, scan pulses marking surveyed cells, simulated telemetry, pause/reset and `onMissionComplete` result. Use procedural fixture first. Do not change global app files or pretend pulses detoxify soil. Include a fixture-based demo and handoff.

### Task E — Scientific UI and mission report

> Implement only Task E in `frontend/src/features/analysis` and `frontend/src/features/report`. Export `AnalysisDashboard` and `MissionReport` with exact shared props. Display comparison/feature contributions, source links, analog gap categories and a print-friendly report, with honest `INCOMPLETE_DATA` treatment. Receive all data as props; never calculate science or invent observations inside UI. No router changes. Include tests and handoff.

### Task F — NASA GIS data

> Implement only Task F in `science/gis`, `data/processed`, `data/sources` and allowed generated terrain assets. Find documented, downloadable DEM subsets for one Mars target and at least two Earth candidate patches; Moon metadata and second pipeline only if time permits. Derive metric features at compatible effective scales, correct body-specific coordinate systems, nodata and provenance; export `FeatureSet` and `TerrainAsset` JSON matching contracts, plus reproducible CLI and tests. No fake measurements or giant raw raster commits. Include data source registry.

### Task G — QA and submission

> Implement only Task G docs/tests/submission. Verify end-to-end user journey, source attribution, provenance versus synthetic labels, app accessibility in incognito, 30-second demo storyboard, public project page, and official AI-assistance disclosure. Do not edit feature code without coordinating with integrator. Produce critical bug list and acceptance checklists.
