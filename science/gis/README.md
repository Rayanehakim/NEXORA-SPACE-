# Task F — georeferenced DEM processing (incremental, evidence-safe)

This code **implements the raster-descriptor stage**, not automated NASA downloads or site selection. It processes two externally obtained, locally georeferenced, cropped **GeoTIFF DEMs** and invokes the **unchanged Task C scoring engine**. It produces `FeatureSet` and `ComparisonResult` objects conforming to the preexisting contracts. No measured scores or NASA elevation files are included in this checkpoint. Never call synthetic tests NASA measurements.

## Ubuntu prerequisites

From `echo-void-atlas-starter`:

```bash
python3 -m pip install -r science/gis/requirements.txt
python3 -m unittest discover -s science/gis/tests -v
python3 -m unittest discover -s science/tests -v
```

## Source selection and geographical preparation

1. Pick the **exact, bounded** Earth patch and a corresponding planetary patch, not the approximate catalog markers. Archive and cite source product/granule IDs, original files, projection details, acquisition/version, URL and vertical-datum information. Candidate archives are recorded in `data/sources/catalog-task-f.json`.
2. Acquire actual Earth **NASADEM** data via NASA Earthdata, and actual Mars **MOLA MEGDR** or lunar **LOLA GDR** data from the NASA PDS. These datasets have different effective resolutions and may include interpolated pixels. Raw files are deliberately absent and ignored by Git.
3. Independently project and crop **each world's DEM** into its own correct *local metre* projected coordinate system. Do **not** use an Earth EPSG projection on Mars or Moon. Do not apply the Earth's planetary radius or vertical datum to another body. Preserve nodata masks. Do not upsample to claim finer physical detail.
4. Export single-band, **north-up, square-pixel** projected GeoTIFFs with exactly matching **pixel dimensions**, **cell sizes in metres**, and **physical footprint extents**. Matching footprints do **not** mean matching geographic longitude/latitude degrees. Keep original source files and detailed transformation/warp commands outside this archive for audit.
5. Copy `science/gis/examples/manifest-TEMPLATE.json` to a working manifest. All bounds and rasters in the template are **examples only** — the example coordinate windows are *not verified study windows*. Replace all placeholders with the actual surveyed geographic windows and GeoTIFF paths, verify embedded GeoTIFF CRS equals declared `crs`, and set `roughnessWindowM` to an **odd** number of grid cells (e.g. 3 × 500 = 1500 m). Verify actual source native resolution against the analysis grid. The template's Mars custom CRS is only an illustrative projection choice; confirm suitability with planetary GIS documentation.
6. Run:

```bash
python3 -m science.gis.cli --manifest /path/to/real-manifest.json --output-dir data/processed/erfoud-jezero
```

Outputs:

- `earth-features.json`, `target-features.json`: shared `FeatureSet` v1 structure.
- `analysis-plan.json`: declared matched windows, projection and scale.
- `comparisons/earth-erfoud--mars-jezero--terrain_mobility.json` and `--geological_survey.json`: exact Task C `ComparisonResult` outputs.
- Optional `terrain/earth-erfoud.json`: Earth-only ECHO `TerrainAsset`, permitted only for *fully valid*, explicitly `MEASURED` raster inputs when `exportEarthTerrain` is true. **Drone flight is still simulated** even with real terrain.

To display a genuinely validated result in Task E, copy the appropriate `comparisons/*.json` into `frontend/public/comparisons/`, keeping the filenames. The existing UI looks them up using site ID + target ID + mission profile. **Do not copy simulated test outputs into that public directory.** The ECHO terrain remains procedural until the app's site terrain selection is explicitly wired to a reviewed `TerrainAsset`; generating JSON does not silently change mission behavior.

## Feature definitions (the existing Task C contract)

- Mean slope: interior centered differences `atan(hypot(dz/dx,dz/dy))`, expressed in degrees; neighborhoods touching missing pixels excluded.
- P90: 90th percentile by nearest rank on valid interior slope values.
- Roughness: mean of population standard deviations of residuals after fitting local least-squares planes, using complete odd-sized square windows; edges excluded without padding.
- Relief: highest minus lowest finite elevation across the bounded raster.
- Valid fraction: fraction of finite, non-nodata raster samples. Any missing coverage produces `INCOMPLETE_DATA` with a **null model score** under the existing Task C minimum-valid-fraction policy of 1.0.

Inputs must be at least 5×5; requested roughness window must be odd, at least 3 cells, and fit within the raster. Grid cells must be square, projected in metres and aligned north-up (rotation forbidden). The input TIFF's SHA-256 and raster metric bounds are recorded in processing provenance. The code performs validation of declared CRS and pixel grid metadata; **it does not independently verify that Earth/Mars source products and declared long/lat study bounds are authentic or spatially consistent**. That requires GIS inspection and independent scientific review.

## Resolution and evidence cautions

MOLA's coarse global grid can limit terrain comparison to hundreds-of-metres scale; 30 m NASADEM and ~463 m MOLA are **not** directly comparable without deliberately coarsening Earth and documenting the choice. Fine scale geological/rover navigation cannot be inferred from coarse global data. Choose actual product-specific resolution and matched scale. LOLA south-polar products may require a polar stereographic CRS and coverage assessment.

A `READY` comparison is an **experimental terrain-descriptor model output**, not NASA certification, engineering validation, or a geologic match. The scoring model's weights/tolerances are project-defined, not NASA thresholds. Mission operations, drone footprints and images are separate simulations.

Do not commit GB-sized raw rasters; keep them locally and cite stable archival URLs and checksums. Review the generated feature files, analysis plan, output gaps and provenance together before publishing.
