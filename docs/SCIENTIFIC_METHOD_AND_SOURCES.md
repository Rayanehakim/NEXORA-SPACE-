# Scientific method and source status

The sole terrain scoring implementation is `science/scoring/engine.py`; the website validates and displays its supplied results rather than computing replacement scores. `science/scoring/model-v1.json` versions both objectives, weights, tolerances and coverage policy. The values are experimental project choices, not NASA thresholds. Feature definitions and limitations are documented in `science/scoring/README.md`.

GIS extraction uses central-difference interior slopes, nearest-rank P90, local least-squares plane-residual roughness and footprint relief. Earth and planetary rasters must use body-correct projected horizontal metres, matched scale/footprints and documented valid coverage. Geographic bounds are inverse-transformed from the actual prepared raster footprint; an Earth metres-per-degree approximation is not used on Mars. Integer missing-data cells remain missing after floating-point conversion. Resampling does not add instrument observations.

For Atacama sensitivity, the committed tool now accepts the selected center and southern UTM CRS:

```sh
python -m science.gis.evidence_checks sensitivity --earth-dem EARTH.hgt --mars-dem MARS-crop.tif --earth-lat -24.5 --earth-lon -69.25 --earth-crs EPSG:32719 --output-grids-dir OUTPUT_GRIDS --output SENSITIVITY.json
```

These are proposed catalog-centered windows; validate their scientific relevance independently. No new raw products or measured outputs were created by these fixes. Existing provisional QA values must be reproduced from original data before promotion into scored results. The 38.8 percent snapshot statistic describes native count bins with at least one shot, not prepared-cell completeness, statistical confidence, validated accuracy or mission suitability.

Source references retained for verification:

- NASADEM collection: https://doi.org/10.5067/MEASURES/NASADEM/NASADEM_HGT.001
- NASADEM user-guide reference from the prior quality review: https://lpdaac.usgs.gov/documents/2237/NASADEM_User_Guide_V13.pdf
- MOLA archive and product documentation: https://pds-geosciences.wustl.edu/missions/mgs/megdr.html
- MOLA map documentation: https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/extras/mola_envi.htm
- Mars environmental background: https://science.nasa.gov/mars/facts/
- Moon environmental background: https://science.nasa.gov/moon/facts/

These references identify collections/background; they do not replace exact product IDs, versions, labels, hashes and processing audits. `data/sources/catalog-task-f.json` and `data/evidence/provisional-review.json` explicitly retain unresolved verification status. Public quantitative artifacts are blocked without a reviewed ledger entry; approval and hashes still cannot independently establish geophysical truth.
