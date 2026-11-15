# Scientific scoring engine

This CLI compares **one Earth region with one Mars or Moon region**. It does not find or rank candidates, extract DEM metrics, or validate scientific truth. The current model is experimental and must be reviewed before real-site scientific interpretation.

## Run

From `echo-void-atlas-starter`:

```powershell
python -m pip install -r science/scoring/requirements.txt
python -m science.scoring.cli EARTH.json TARGET.json --plan PLAN.json --profile terrain_mobility --output comparison.json
python -m unittest discover -s science/tests -v
```

Supported objectives are `terrain_mobility` and `geological_survey`. JSON is printed to stdout if `--output` is omitted. Exit status 0 means a result was emitted, including an honest `INCOMPLETE_DATA` result. Unreadable/malformed JSON, unsupported CLI options and failed output writes exit with status 2. Missing analysis plans never generate a score. `compare` remains importable from `science.scoring.cli` and is implemented in `engine.py`.

## Reproducible synthetic example

```powershell
python -m science.scoring.demo --output-dir science/scoring/examples
python -m science.scoring.cli science/scoring/examples/synthetic-earth.json science/scoring/examples/synthetic-mars.json --plan science/scoring/examples/synthetic-plan.json
```

This returns 100 from identical **SIMULATED scalar inputs**. The example bounds, projection declarations and footprint metadata are test values, not a georeferenced measured experiment. A score of 100 here is an algorithm identity check only. `synthetic-result.json` is a sample contract-compatible output, not a candidate ranking.

## Model and explanation

`model-v1.json` declares all tolerances, mission weights, coverage policy and the model version before any real-site rankings. All four metrics are mandatory:

| Feature | Unit | Tolerance | Terrain mobility weight | Geological survey weight |
| --- | --- | --- | --- | --- |
| Mean slope | degrees | 10 | 0.35 | 0.15 |
| P90 slope | degrees | 15 | 0.30 | 0.20 |
| Residual roughness | metres | 20 | 0.25 | 0.35 |
| Relief | metres | 100 | 0.10 | 0.30 |

These are project-defined experimental settings, not NASA limits or empirically calibrated tolerances. Neither profile measures geological equivalence; the geological profile is still only a terrain-descriptor model.

For each metric, normalized distance is `min(1, abs(earth-target)/tolerance)`. A row's contribution is its **weighted loss** `weight * distance`, not a similarity percentage. The index is `100 * (1 - sum(weighted losses))`, rounded to eight decimal places and bounded to 0–100. Weights must sum to one. If a required input or compatibility declaration fails, score, normalized distances and weighted losses are null. Valid scalar input values remain visible in the output for diagnosis. Zero measurements are valid.

## Input contract and analysis plan

Inputs retain the shared `FeatureSet` schema unchanged. `analysis-plan.schema.json` defines a separate sidecar with two regions in Earth then target order. Each region declares its ID/body, bounded longitude/latitude window, projected CRS, horizontal metres, footprint width/height and roughness window. IDs and bodies must match the input files. Dimensions and roughness windows must match across the pair; scales and processing algorithm versions must match too. The sidecar records the `terrain-descriptors-v1` definitions below.

Metadata checks reject geographic-degree CRSs used as metres, Earth EPSG identifiers used for planetary data, unsupported coordinate extents, mixed measured/simulated evidence, missing provenance, and analysis finer than native source detail. The conservative model requires full valid coverage. That is a project policy, not a universal science requirement.

The engine checks **declared metadata**. It does not resolve CRS registries, inspect raster grids, prove footprint dimensions match geographic bounds, check a claimed body's projection radius, or verify how numbers were computed. Those checks belong to the later GIS pipeline and independent scientific review. A plausible declaration can still be scientifically wrong.

## Terrain descriptor definitions

The future GIS pipeline must implement and record these definitions before producing compatible measured inputs:

- Mean slope is the arithmetic mean of local slope angles in degrees. Compute local gradients on a common effective grid with central differences in projected horizontal metres, then `atan(hypot(dz/dx,dz/dy))`. Exclude neighborhoods with missing inputs. The derivative convention and boundary treatment must match across bodies.
- P90 slope uses the same valid local slope population and a documented nearest-rank 90th percentile.
- Roughness is residual elevation standard deviation after fitting a local least-squares plane in a square physical window of `roughnessWindowM`. Use population standard deviation in metres, then average valid local window values over the study footprint. Record the complete-window and edge treatment consistently. Raw elevation standard deviation is not this metric.
- Relief is maximum minus minimum valid elevation in metres across the declared matched physical footprint. Absolute mean elevations from different vertical datums do not enter this model.

This task consumes scalar descriptors; it does not implement the raster extraction above. The demonstration inputs are not asserted to have been extracted with these methods.

## Gaps and evidence

Every result has PHYSICAL, PLANETARY, EVIDENCE and OPERATIONAL gaps. Severity remains UNKNOWN because no validated severity thresholds exist. Planetary background is linked to NASA's [Mars facts](https://science.nasa.gov/mars/facts/) and [Moon facts](https://science.nasa.gov/moon/facts/). The implications for field rehearsal are project interpretations of those facts. These background links are not sources for terrain measurements.

Measured inputs require source identity, version, source URL, native resolution and processing method. Simulation provenance is preserved and visibly disclosed in the result. `READY` means the model can compute from the supplied inputs; it does not mean NASA validation, safety certification, or a measured result. The evidence warnings remain present even for READY experimental results.

The shared gap contract has only one source URL per gap, so the physical gap links the first measured source while `sourceIds` retains all distinct input provenance IDs. Keep both input files with the output for the full source URLs, plan and processing details.
