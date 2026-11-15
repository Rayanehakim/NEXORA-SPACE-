# Integration branch fixes and teammate handoff

Branch: `feature/nexora-full-integration`. The original `DEPLOYMENT_ASSESSMENT.md` describes the earlier `fcdcc71` snapshot; this file records the subsequent fixes.

## Implemented fixes

- One canonical root application: `frontend/`, `science/`, `contracts/`, `data/`, `docs/`, `submission/`. Removed the obsolete nested starter source and tracked compiler cache. Local generated caches are ignored.
- Root commands and CI now build/test the intended frontend. The science job includes the GIS suite, shared schemas and reviewed-artifact verification; the frontend job depends on it. No automatic deployment is configured.
- Geographic study bounds come from inverse-transforming the actual raster footprint using the correct body's CRS. Added Earth/Mars regression checks.
- Integer masked rasters are converted to floating point before filling with NaN. Missing values remain missing in extraction and sensitivity checks.
- Sensitivity processing accepts Earth/Mars coordinates and an Earth output CRS, including Atacama's southern UTM projection.
- READY payload validation checks feature uniqueness, units, ranges, normalized distances, weighted losses, weight totals, score consistency, gap categories and safe source URLs. Both analysis and report validate direct props; report exports reject a mismatched objective.
- Comparison fetches distinguish loading, missing evidence, invalid payloads and network errors, with retry and stale-response protection.
- Analysis/report supporting evidence is expandable and body text is readable. Report printing opens supporting evidence and restores its screen state afterward. The 480-pixel ECHO viewport and original root drone source/tests are preserved.
- Builds reject unreviewed public score/DEM artifacts. The empty `data/evidence/releases.json` is intentional; no measured score is approved. Provisional snapshots remain visibly unverified, with missing evidence recorded in `data/evidence/provisional-review.json`.
- Added canonical setup/deployment instructions, source-status records, method notes, an AI/asset disclosure draft and a 30-second recording storyboard.

## Validation

Final local checks cover frontend tests (including rendered analysis/report, downloads, request states and release-gate regressions), typecheck, production build, 23 GIS tests, 14 scoring tests, contract examples, the reviewed-artifact check and original drone tests. The scientific examples remain synthetic tests, not source-data verification. The existing lazy ECHO bundle size advisory remains.

## Continue work

```sh
git switch feature/nexora-full-integration
git pull --ff-only
npm --prefix frontend ci
npm run dev
```

Run `npm test`, `npm run typecheck`, `npm run build`. For Python, create a virtual environment, install `science/gis/requirements.txt`, and run the commands in the root README. Use `frontend/dist` as the only static deployment output.

## Not yet verified or completed

1. Real browser/mobile/WebGL/print smoke tests. Desktop Computer Use stopped because it could not reliably identify Brave's current URL; this was an automation policy limitation, not a passing browser test. Follow `docs/DEPLOYMENT.md` manually or with an available supported browser surface.
2. Original NASADEM/MOLA product/label verification, source-class and count audits, regenerated processing manifests and scenario outputs, and independent scientific review. The source rasters are not present here; existing QA numbers were not recalculated or promoted to scores.
3. A staging/public deployment, incognito/deep-link checks on that URL, current event-rule verification, finished video/slides and actual competition submission.

Do not mark the review ledger approved or change catalog readiness until the corresponding data review is complete. Source fixes and automated checks support continued development; they do not establish scientific or deployment certification.
