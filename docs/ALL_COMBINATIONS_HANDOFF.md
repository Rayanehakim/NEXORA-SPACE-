# All ten local Earth–planet combinations

All five Earth candidates (Erfoud, Atacama, Askja, Haughton and McMurdo) now have locally reproduced terrain trials against both Mars/Jezero and the lunar south pole. All ten use **5 km squares, 500 m cells, 10 × 10 prepared grids and a 1500 m roughness window**. Every pair has complete prepared elevation coverage in five scenarios: average baseline, bilinear, nearest, average shifted northeast and southwest by 250 m in each projected axis.

Analysis and Report display the exact selected pair's slope, P90 slope, plane-detrended roughness, relief, processing ranges and native observation-quality evidence. Exports retain that same pair's QA. The old unequal-footprint trials remain historical artifacts and are superseded in the UI. No approved numerical compatibility score is published; experimental indices for both mission profiles are generated in ignored local review files.

## Sources now present

| Earth candidate | Supplied source | Prepared CRS |
|---|---|---|
| Erfoud | NASADEM HGT N31W005 plus NUM/SWB | EPSG:32630 |
| Atacama | NASADEM HGT S25W070 plus NUM/SWB | EPSG:32719 |
| Askja | Two Copernicus tiles N64/N65 W017 | EPSG:32628 |
| Haughton | ArcticDEM 29_29 32 m, metadata version 4.1 | EPSG:3413 |
| McMurdo | REMA 18_35 32 m, metadata version 2.0 | EPSG:3031 |

Mars uses local MEGT44N000HB topography and MEGC44N000HB counts with supplied `.txt` PDS3 labels (label-reported version 2.0). The importer checks Mars identity, product names, signed 16-bit big-endian metre topography versus unsigned 8-bit counts, dimensions/file sizes, 128 pixels/degree, bounds, axis direction and 3396 km sphere. A VRT maps the validated tile's pixel corners to 0–90° E and 44–0° N; byte order is explicit. Its metric analysis projection uses the Mars sphere, Jezero central longitude and local standard parallel. Raw VRT sources stay beside their VRTs; no GDAL source-access restrictions are disabled.

The Moon uses the supplied aligned LOLA elevation, count and effective-resolution layers on its 1737.4 km sphere and polar stereographic grid. Its trial is centered at 88.5° S, 0°. Jezero is centered at 18.38° N, 77.58° E. Earth centers remain the catalog pins. Planet-specific coordinate systems are never replaced by terrestrial WGS84.

## Reproduce

Keep the original eleven raster/archive inputs and two label text files at repository root, with their supplied filenames. Install `science/gis/requirements.txt`, then run:

```powershell
& ./.venv/Scripts/python.exe -m science.gis.local_catalog
```

The CLI writes prepared rasters, all scenario descriptors/plans and experimental comparisons under ignored `data/processed/local-catalog/`. It writes the frontend snapshot to `frontend/src/data/localCatalogEvidence.json`. It never publishes public comparison or simulator terrain assets.

Tracked reproduction artifacts are under `data/evidence/local-catalog/`: the input manifest with archive/label hashes, validated label copies, code/library versions, all ten snapshots, all fifty scenarios, baseline feature pairs and analysis plans. Large originals/prepared rasters remain ignored. Regenerate and review these small artifacts together when changing the pipeline or inputs; code hashes identify the exact implementation used.

## Interpretation and review

Complete elevation coverage is not complete direct observation. MOLA topography explicitly interpolates empty observation bins. MOLA native-bin counts are read using the detached label; LOLA weights can be fractional because of blending. Native count diagnostics remain separate from prepared cells. Effective resolution is spatial sampling support, not absolute elevation accuracy.

NASADEM NUM/SWB samples are recorded as raw classification histograms at prepared-cell centers; their independent interpretation/audit remains pending. Polar strip counts and MAD describe mosaic contributions and dispersion, not lunar laser observations or absolute accuracy. Copernicus and stereo surface models can include vegetation, ice, snow and artifacts. Only within-window shape descriptors are compared; absolute heights across different vertical datums are not compared.

These common settings enable consistent experimental processing, not a scientifically validated analog ranking. A 10 × 10 grid describes broad terrain and cannot resolve drone-scale hazards. Study-window suitability, source authenticity, geology, operational access and independent scientific review remain pending. Scenario ranges are processing sensitivity, not confidence intervals. The release ledger remains empty; ECHO retains its procedural Earth demonstration and unchanged viewport.

## Attribution

- [NASADEM HGT V001, NASA/USGS, NASA LP DAAC](https://doi.org/10.5067/MEASURES/NASADEM/NASADEM_HGT.001).
- [Copernicus DEM](https://doi.org/10.5270/ESA-c5d3d65); the full required credit is retained in snapshots and displayed for Askja.
- Polar Geospatial Center, University of Minnesota, NGA/NSF: [ArcticDEM](https://www.pgc.umn.edu/data/arcticdem/) and [REMA](https://www.pgc.umn.edu/data/rema/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modified by reprojection, resampling and descriptor extraction. Bundled metadata identifies contributing strips.
- [NASA MGS MOLA / PDS Geosciences Node](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html).
- [NASA GSFC PGDA LOLA products](https://pgda.gsfc.nasa.gov/products/90), [Barker et al. (2023)](https://doi.org/10.3847/psj/acf3e1).

Local hashes identify supplied bytes; they do not independently authenticate an archive or constitute scientific approval. No NASA endorsement is implied.
