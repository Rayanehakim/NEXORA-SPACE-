# NEXORA SPACE — first measured raster pair: source-quality review

**Status: PROVISIONAL / NOT APPROVED FOR PUBLIC SIMILARITY SCORES**

## What was verified

- User-provided NASADEM_HGT_n31w005.zip contains `.hgt`, `.num`, `.swb` 3601×3601 native rasters for an Erfoud-area tile.
- Original MOLA `MEGT44N000HB.IMG` has expected 5632×11520×2 bytes. User-provided matching PDS3 label says: median topography, 128 px/degree, 16-bit big-endian integers, 0–44°N and 0–90°E, heights in metres, Mars coordinate sphere radius **3,396.0 km**. MOLA pixel coverage can include interpolated values.
- Corrected processing uses **+R=3396000** consistently for the MOLA geographic crop, center mapping and local projected output. The earlier provisional output had mismatched 3396000/3396190 radii; retire the earlier resulting scientific metrics.
- Matched windows are 32×32 km at 1000 m cell size. Both have valid elevation data in all 1024 cells; this is **not** a claim of independent measurements at every Mars pixel.
- NASADEM auxiliary `.num` layer sampled at the centers of the 1024 *coarsened* cells: 909 class 2, 106 class 3, 9 class 4. All are class 1–23 SRTM-derived sources as documented by NASADEM. This is a sample, not an area-exact classification of the native source pixels.
- `.swb` water mask sampled at those centers: all 1024 cells have land flag 0.
- 10 GIS tests and 14 scoring tests continue passing after the radius adjustment. **Synthetic code tests do not independently validate source data quality.**

## Remaining blockers before displaying scores in the website

1. Acquire matching MOLA **counts** product for this same tile and version; distinguish observed shots from interpolated MOLA topography, then quantify fraction and spatial arrangement of unsupported cells. Do not conflate DEM completeness with shot coverage.
2. Preserve or obtain exact detached `.lbl` for the original `.img` as an independently downloadable companion to the pasted user label; cite complete product file/version URL.
3. Test smoothing/downsampling (e.g. average vs bilinear) and small study-window shifts to quantify sensitivity. The present pipeline uses bilinear interpolation to 1 km and labels this experimental rather than certified.
4. Confirm study footprint selection is appropriate for the actual target region, and geological/environmental comparisons remain distinct from four DEM-based terrain features.
5. Do not copy provisional `READY` comparison JSON into `frontend/public/comparisons` until evidence review is complete. `READY` is a schema computation state, not a NASA-vetted suitability score.

## Official definitions used

- NASADEM product and NUM class definitions: https://lpdaac.usgs.gov/documents/2237/NASADEM_User_Guide_V13.pdf
- MOLA map sphere radius and pixel precision: https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/extras/mola_envi.htm
- MOLA archival files and counts naming: https://pds-geosciences.wustl.edu/missions/mgs/megdr.html

## Run location

On Ubuntu, apply the small compatibility patch at the **NEXORA-SPACE- repository root**. It adds `science/gis/audit_pair.py`, replaces `science/gis/prepare_pair.py` to respect this MOLA label's radius, and includes this review in `science/gis/QUALITY_REVIEW.md`. The script `audit_pair.py` takes `--earth-dem`, `--earth-num`, `--earth-swb`, `--mars-dem`, `--prepared-dir`, `--output`. It does not download anything automatically or modify the website.
