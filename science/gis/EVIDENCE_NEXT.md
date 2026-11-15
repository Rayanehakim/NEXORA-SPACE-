# Task F — counts coverage + resampling sensitivity (Ubuntu)

This patch extends the existing GIS QA work. **It does not change the frontend,
existing metric formulas, or any previous source file.** No numeric similarity
score is approved by these checks.

## 1. Download the matching PDS companion

MOLA topography: `MEGT44N000HB.IMG` (already supplied).
Counts (observations per native map cell): **`MEGC44N000HB.IMG`**.
Download the associated **`MEGC44N000HB.LBL`** with the same stem.

NASA PDS3 archival links (exact filename, same map coverage and revision):

- https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/megc44n000hb.img
- https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/megc44n000hb.lbl

NASA now maintains a PDS4 version of the bundle; prefer the PDS4 product
metadata for final source references. These PDS3 links are included because the
previous topography input uses the matching PDS3 MEGT tile. Keep both labels.

**Do not** substitute `MEGR` (planetary radius) or `MEGT` (topography) for
`MEGC` (counts). Source: https://pds-geosciences.wustl.edu/missions/mgs/megdr.html

## 2. Analyze counts once downloaded

From the `echo-void-atlas-starter` folder:

```bash
python3 -m science.gis.evidence_checks counts \
  --counts-img ~/Downloads/MEGC44N000HB.IMG \
  --counts-lbl ~/Downloads/MEGC44N000HB.LBL \
  --mars-metric /PATH/TO/PROVISIONAL/prepared/mars-metric.tif \
  --output ~/Downloads/mola-coverage-review.json
```

Use the actual downloaded capitalization and actual prepared raster path.
The reader refuses mislabeled counts products and checks the binary byte size,
sample packing, tile bounds and planetary target. It reads only Jezero's native
pixel window, then counts zero vs nonzero native cells whose centers lie inside
the prepared metric footprint. **This is not a claim that every 1 km output cell
was independently observed.**

## 3. Resampling sensitivity (already performed on supplied real DEM inputs)

`resampling-sensitivity.json` in the results ZIP contains five alternate
preparations: bilinear, average, nearest (same center) and bilinear with
±500 m north/east footprint shifts. Metrics follow the exact same Task F
`extract_descriptors` implementation. All are 32x32 cells at 1 km spacing.

To replicate when you have the extracted Earth HGT and georeferenced/cropped
Mars topography GeoTIFF:

```bash
python3 -m science.gis.evidence_checks sensitivity \
  --earth-dem /PATH/TO/n31w005.hgt \
  --mars-dem /PATH/TO/mars-jezero-crop.tif \
  --output-grids-dir ~/Downloads/NEXORA_sensitivity_grids \
  --output ~/Downloads/NEXORA_sensitivity.json
```

The original raw MOLA .IMG cannot be substituted for `mars-jezero-crop.tif`
unless it is georeferenced with the correct 3,396 km planetary sphere and
longitude/latitude orientation. The earlier corrected trial supplies the crop
reconstruction script. Keep simulated terrain and drone scans out of the
measured-data comparison.

## Scientific gate

- Counts QA not completed until the exact `MEGC` IMG+LBL are obtained.
- Source product hashes, labels and observation fraction must be preserved.
- Report the range across preprocessing methods; never cherry-pick a single
  favorable score or interpret 100% DEM coverage as 100% laser coverage.
- These are terrain descriptors, **not a complete planetary base suitability
  assessment** (radiation, ice, temperature, geology remain distinct).
- Do **not** copy experimental comparison JSON into the website's public
  comparison directory or replace status warnings with a fabricated score.
