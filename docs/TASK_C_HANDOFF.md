# Task C Scientific engine and gap analysis

Implemented a deterministic Python engine and CLI using the existing FeatureSet and ComparisonResult contracts. Scoring and validation are separate from the four-category gap builder. No frontend science values or shared schemas were changed.

The model configuration versions both mission profiles, fixed tolerances, feature units and a conservative full-coverage policy. These are experimental project settings, not NASA requirements. A separate analysis-plan sidecar declares study windows, projected metre units, matched footprints and roughness windows, and feature definitions without extending the shared FeatureSet contract.

Missing/incompatible inputs emit `INCOMPLETE_DATA` with a null score and diagnostic reasons. Valid inputs produce per-feature distances and weighted losses. All output is validated against ComparisonResult before emission. Missing data is never replaced with zero. Synthetic examples and tests are explicitly simulated.

## Use and verification

From `echo-void-atlas-starter`:

```powershell
python -m pip install -r science/scoring/requirements.txt
python -m science.scoring.cli science/scoring/examples/synthetic-earth.json science/scoring/examples/synthetic-mars.json --plan science/scoring/examples/synthetic-plan.json
python -m unittest discover -s science/tests -v
python scripts/validate_contracts.py
```

The tests cover identity, exact formula, mission-weight differences, monotonicity, saturation, zero values, missing and invalid features, coverage, provenance, scale, footprints, projections, malformed inputs, deterministic output, gap categories, schema conformance and CLI file/stdout behavior. A science job is included in the existing GitHub Actions workflow; remote execution is not yet verified.

## Files and integration

- `science/scoring/`: engine, validation, CLI, versioned configuration, plan schema, synthetic fixtures, requirements and method documentation.
- `science/gaps/analysis.py`: physical, planetary, evidence and operational gap explanations.
- `science/tests/test_scoring.py`: scoring and CLI regression tests.
- `.github/workflows/validate.yml`: Python test and schema-validation job.

Exports: `compare(earth, target, profile='terrain_mobility', plan=None)` from `science.scoring.engine` or the compatible CLI import. CLI emits shared ComparisonResult JSON. Full instructions and definitions are in `science/scoring/README.md`.

## Limits and next integration

The engine validates declarations, not raster truth. CRS registry resolution, actual projection parameters, physical window verification, source retrieval and real DEM metric extraction remain GIS work. The model's settings need scientific review. No real-site score, ranking or measured NASA terrain analysis is claimed.

The website is deliberately unchanged and still shows unavailable scientific results. Later analysis/report work should load validated ComparisonResult artifacts and provenance without computing a second score in the UI. Preserve the feature pair, analysis plan and model version alongside each output.
