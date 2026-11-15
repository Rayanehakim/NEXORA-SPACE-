# Task F → Task E provisional evidence handoff

This patch is applied **after** the previously supplied A–E compact frontend, the Task F GIS patch, NASA preparation, evidence QA, and counts/sensitivity patches. All preceding Python modules are preserved.

- `frontend/src/features/analysis/evidenceRecord.json`: a small, audited read-only QA snapshot derived from the user-uploaded MOLA count raster and five real DEM preprocessing scenarios. No raster binaries are bundled.
- `frontend/src/features/analysis/evidence.tsx`: a QA panel shared between the Analysis and Report screens.
- The panel appears **only** for `earth-erfoud` and `mars-jezero`; changing mission selection suppresses it.
- It is deliberately separate from `ComparisonResult` and `useComparison`. It **never releases a similarity score** and never changes drone simulation results.
- JSON mission exports include a `terrainEvidenceQA` field only when the pair matches, explicitly marked `PROVISIONAL_QA`.
- 38.8% counts native 128-pixels-per-degree MOLA bins with at least one laser shot, **not** prepared output-cell coverage or certainty of terrain elevation.
- Original MOLA counts `.lbl` needs independent source-file verification for publication; prior calculation used a user-supplied transcription. Roughness varies by resampling approach.
- Source registry: NASA Earthdata NASADEM HGT n31w005; MOLA MEGT44N000HB and MEGC44N000HB through PDS.

Run on Ubuntu from `echo-void-atlas-starter/frontend`:

```bash
npm test
npm run typecheck
npm run build
npm run dev
```

**Do not** copy provisional comparison files into `frontend/public/comparisons` as a READY score.
