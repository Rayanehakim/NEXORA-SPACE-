# Assessment of Tasks E F and G before deployment

Historical assessment of the pre-fix snapshot. Subsequent implementation and remaining verification steps are recorded in `docs/DEPLOYMENT_FIXES_HANDOFF.md`.

Reviewed branch: `origin/feature/nexora-full-integration`.
Reviewed commit: `fcdcc71e81c417a87ad253f8e79542a7be12c0a2`.
Comparison base: main at `83468cb`.

Assessment only. No source fixes, merge, push or deployment were performed. The branch was exported into an isolated review directory; main and the running development server were not switched.

## Decision

There is substantial useful implementation, but do not deploy the branch as-is. It contains two competing application trees, release commands target the older application, and additional checks reproduced scientific-processing and validation bugs. A clearly labelled provisional prototype can be released after the application/CI wiring and browser QA are corrected. A release with meaningful real-site similarity scores additionally needs the evidence and science gates below.

## What is implemented

| Task | Implemented | Still needed |
| --- | --- | --- |
| E Analysis and report | Contract-shaped AnalysisDashboard and MissionReport, selection-keyed comparison fetch, stale-request aborts, incomplete/ready rendering paths, four gap categories, source IDs, provisional QA panels, JSON download and print styles | Harden READY validation; complete explainability and source links; distinguish loading/fetch failure from missing evidence; render and interaction tests of both states; real-browser print/mobile checks |
| F GIS | Metre-grid slope, nearest-rank P90, local plane-residual roughness and relief extraction; masks and coverage; CRS checks; pair preparation; artifact generation; batch jobs; count-grid and sensitivity tools; two provisional QA summaries | Fix bounds and integer-nodata errors; preserve reproducible evidence package; verify source labels and source quality; reproduce Atacama sensitivity with the committed tools; approve at least one measured pair before publishing scores |
| G QA and submission | Automated unit/DOM checks, schema validation, evidence caveats, source-quality review notes and inherited submission checklist | CI must exercise the new tree and GIS tests; full scenario twice in browser, keyboard/mobile/WebGL fallback/print/download checks; hosted deep-link and incognito tests; consolidated method/citations/AI disclosure; actual storyboard/video or slides and submission completion |

## Findings in priority order

### 1 Release commands and CI target the wrong application

The branch adds new root-level `frontend/`, `science/`, `contracts/`, `docs/` and `submission/` trees while retaining `echo-void-atlas-starter/` with the old application. Root package scripts still run `npm --prefix echo-void-atlas-starter/frontend ...`. The workflow still tests/builds the nested frontend and uploads its dist. Its science job also runs the nested scoring suite, not the new root GIS pipeline. A green existing workflow therefore does not establish that E/F/G work is tested or included in the deployment.

Choose one canonical source tree and align root scripts, dependency install, workflow working directories, cache paths, Python requirements/test discovery and artifact directory. Update setup documentation too. A host can explicitly build root `frontend/`, but doing so alone leaves local commands and CI inconsistent.

References: `package.json:5`; `.github/workflows/validate.yml:8`, `:21`, `:37`.

### 2 Mars preparation writes incorrect geographic study bounds

`science/gis/prepare_pair.py:106` uses an Earth constant of 111320 metres per degree for both Earth and Mars. Those approximate bounds are then copied into the analysis manifest at line 156. The actual projected raster can be prepared correctly while its declared geographic window is wrong.

Reproduction with a synthetic, correctly projected Mars raster and a 32 km square:

- Declared latitude span: 0.2874595759971257 degrees.
- Actual span from inverse-transforming the output GeoTIFF bounds with its own planetary CRS: 0.5398895596050153 degrees.
- Declared span is about 53.2 percent of the actual span.

Compute bounds by transforming the actual output footprint into the body's geographic CRS; test both Earth and Mars. Rebuild dependent manifests/audits. This check did not reprocess or reject the hard-coded provisional UI measurements; their original input artifacts are not in this branch.

### 3 READY comparison validation accepts invalid scientific rows

`frontend/src/features/analysis/comparisonValidation.ts:14` checks finite values but omits important constraints. An independently constructed payload was accepted with READY status, score 99, weight 4 on every feature, negative normalized distances and negative contributions, plus metre units on slope features.

Before enabling published scores, enforce per-feature units and physical ranges, weights in 0–1 with total one, distances in 0–1, nonnegative weighted losses, and non-null values for every READY row. Add regression tests. Ensure the displayed score is consistent with the supplied contribution breakdown and approved model artifact without introducing a competing frontend science model. The existing test fixture itself uses score 81 with four 0.025 losses, which would imply 90 under the model formula.

### 4 Integer rasters with nodata crash extraction

`science/gis/pipeline.py:91` calls `filled(np.nan)` before converting the masked data to floating point. A synthetic projected int16 GeoTIFF containing a nodata pixel raises `TypeError: Cannot convert fill_value nan to dtype int16`. The sensitivity helper at `science/gis/evidence_checks.py:124` uses the same pattern.

Convert the masked array to floating point before filling missing samples and add an integer-nodata regression test. The preparation utility currently emits float32, so this does not invalidate every prepared-file path; it breaks the documented general GeoTIFF input path.

### 5 Provisional measurements are not reproducible from the committed evidence package

The UI includes Erfoud–Jezero and Atacama–Jezero scalar summaries, a MOLA count-file hash, measurement ranges and explicit provisional/no-score labels. These are useful progress, and the code does not publish numeric similarity scores for them.

However, the tree contains no measured feature artifacts, prepared manifests, scenario output/audit JSON or complete source registry for these summaries. `data/sources/` contains only a README; the GIS README references `data/sources/catalog-task-f.json`, which is absent. Generated processed files are ignored. Keeping raw rasters out of Git is appropriate, but lightweight manifests, exact product/version references, input and output hashes, companion labels or archival label references, commands and reviewed QA results still need a reproducible home.

The summaries explicitly state that the original MOLA count label has not been independently verified. The Atacama source-class audit is also documented as incomplete. Reproduce and review these before presenting them as verified measurements; until then, keep the present provisional language and no-score behavior.

The committed sensitivity runner (`science/gis/evidence_checks.py:142`) is hard-coded to Erfoud coordinates and the default northern UTM projection. It cannot reproduce the Atacama experiment as-is. Add site/CRS parameters or preserve the actual separate Atacama processing script and manifest.

### 6 No measured comparison or real ECHO terrain is shipped

`frontend/public/` contains only planet illustrations. There is no comparisons directory or terrain directory, and every catalog entry still has `terrainAssetUrl:null`, empty dataset references and incomplete status. The default website will show provisional QA for two Mars pairs and unavailable comparison scores; ECHO remains procedural for all sites. This is correct as an explicit prototype, but it is not an end-to-end measured scoring release.

For a scored release, approve a comparison artifact for the intended pair/profile, retain its inputs/plan/model/source provenance, wire the matching asset path, and update catalog availability consistently. Other sites and Moon mode can remain explicitly pending; acquiring every catalog pair is not required for a scoped prototype deployment.

### 7 User-facing QA and submission remain incomplete

There is no committed browser end-to-end suite, hosted deep-link/rewrite configuration, completed submission checklist, final AI-use disclosure, or demo storyboard/video/slide artifact. Several QA tests read constants and source text rather than mounting AnalysisDashboard/MissionReport and exercising their interactions. They do not verify print pagination, downloads, mobile layout, WebGL fallback or a real user journey.

The new analysis and report desktop media queries reintroduce 11–12 px body/metric text and stack additional evidence panels. This conflicts with the previously agreed readable typography and low-scroll direction; visually review it before accepting the branch. The assessment did not obtain a working browser automation surface, so it makes no claim about actual rendered appearance.

No hosting provider or domain is selected here. Before public launch, explicitly configure the canonical frontend build/output and SPA fallback for /explore, /analysis, /simulation and /report. Check online map availability/attribution, all planet assets and network-failure behavior on the deployed URL. Incognito/public-link checks can only be completed after a staging deployment exists.

## Verification performed on the new root-level code

| Check | Result |
| --- | --- |
| Clean locked dependency install in root frontend | Passed |
| Root frontend typecheck | Passed |
| Root frontend production build | Passed; existing lazy ECHO chunk size advisory remains |
| Root frontend tests | 28 passed |
| Root GIS tests | 20 passed |
| Root scientific scoring tests | 14 passed |
| Shared JSON schema example validation | Passed |
| Original root drone tests | Passed |
| Additional malformed READY payload check | Confirmed validator accepts invalid rows |
| Additional Mars bounds check | Confirmed incorrect declared span |
| Additional integer nodata raster check | Confirmed TypeError |
| Real source-raster reproduction | Not possible from committed artifacts |
| Actual browser/mobile/print/WebGL smoke test | Not verified |
| Hosted deep links, incognito access and deployment | Not performed |

The GIS dependencies were installed into an isolated review target, not into the main source environment. Passing synthetic tests confirms code behavior only; it does not independently validate the source measurements.

## Recommended sequence

1. Consolidate the application tree and correct local/CI/deployment paths.
2. Fix the confirmed bounds, integer-nodata and READY-validation bugs with targeted regressions.
3. Verify the intended prototype behavior and typography in a real browser, including completed survey → report, JSON download and print.
4. Preserve the provisional evidence clearly, or complete the label/source/reproducibility review and publish a reviewed measured comparison. Do not silently promote QA snapshots into scores.
5. Deploy a staging build; test direct routes, incognito/mobile access, tiles/assets and failure states.
6. Finish Task G's method, citations, AI disclosure, demo materials and submission checklist before describing the competition deliverables as complete.

Branch code links for the principal findings:

- https://github.com/Rayanehakim/NEXORA-SPACE-/blob/fcdcc71e81c417a87ad253f8e79542a7be12c0a2/package.json#L5
- https://github.com/Rayanehakim/NEXORA-SPACE-/blob/fcdcc71e81c417a87ad253f8e79542a7be12c0a2/.github/workflows/validate.yml#L8
- https://github.com/Rayanehakim/NEXORA-SPACE-/blob/fcdcc71e81c417a87ad253f8e79542a7be12c0a2/science/gis/prepare_pair.py#L106
- https://github.com/Rayanehakim/NEXORA-SPACE-/blob/fcdcc71e81c417a87ad253f8e79542a7be12c0a2/science/gis/pipeline.py#L91
- https://github.com/Rayanehakim/NEXORA-SPACE-/blob/fcdcc71e81c417a87ad253f8e79542a7be12c0a2/frontend/src/features/analysis/comparisonValidation.ts#L14
