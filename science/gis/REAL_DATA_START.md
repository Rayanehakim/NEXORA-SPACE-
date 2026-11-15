# Task F: first real NASADEM–MOLA experiment (Ubuntu)

This step does **not** automatically claim that a measured comparison exists. You must obtain the **original elevation products**, verify the PDS labels and Earthdata granule metadata, and review the outputs. Neither screenshots, basemap tiles, nor the MOLA **shaded-relief** image are valid DEM inputs.

## Official archives (the 2026 challenge links to Earthdata and PDS)

- Earth: [NASA Earthdata Search](https://search.earthdata.nasa.gov/search?q=NASADEM_HGT) — collection `NASADEM_HGT.001` / DOI `10.5067/MEASURES/NASADEM/NASADEM_HGT.001`. Select an **Erfoud-covering HGT granule**, authenticate to Earthdata if requested. Download its ZIP, extract `.hgt` and retain the archive metadata/granule ID. The 1° tile including 31.42°N, -4.24° longitude is nominally **N31W005**; check the granule's actual footprint and validity. NASADEM ~1 arc-second is not uniformly a 30-m horizontal ground resolution.
- Mars: [NASA PDS MOLA MEGDR](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html) — **PDS4 maintained bundle**, data at 128 pixels/degree where available. Select an actual **topography** product (`MEGT...`; not radius `MEGR...`, count `MEGC...`, or shaded relief). Jezero at about 18.38°N, 77.58°E falls in the approximately 0–44°N / 0–90°E MOLA 128ppd tile (historical PDS3 name `megt00n000hb.img`). Download the matching `.img`, `.xml`, `.lbl`, and `.hdr` from the maintained PDS4 archive; retain them together. Check the exact file ID, product version and the documentation.

The archive products are **not shipped** in this project. Original data can be large (the historical tile above is approximately 130 MB) and may need an account on Earthdata. Don't add raw DEMs to Git.

## Before preparing any comparisons

Open each actual DEM and inspect the CRS, geographic footprint, nodata, raster dtype, height units and the PDS product label. For MOLA, **the planetary radius/datum and longitude direction matter**. Do **not** assign WGS84 / `EPSG:4326` to Mars. Some PDS `.img` files require GIS-aware conversion and assignment of the documented *Mars* geographic CRS using the official PDS `.lbl` / `.xml` before rasterio can read a geographic extent. The preparation utility **will refuse an unreferenced Mars file**, rather than guessing its georeferencing.

Quick inspection (from repository root, after `pip install -r science/gis/requirements.txt`):

```bash
python3 - <<'PY'
import rasterio
from pathlib import Path
for p in [Path('data/raw/earth/N31W005.hgt'), Path('data/raw/mars/MEGT...img')]:
    if not p.exists():
        print('Missing:', p); continue
    with rasterio.open(p) as d:
        print(p, 'driver=', d.driver, 'crs=', d.crs, 'bounds=', d.bounds,
              'size=', (d.width,d.height), 'nodata=', d.nodata, 'units=', d.units)
PY
```

## Create the matched metric windows

Once you have **checked and georeferenced** both DEMs, substitute the real filename/product identifiers below. A 64 × 64 grid at 1,000 m spacing creates matched **64-km × 64-km** windows in *separate* Earth UTM and Mars equidistant-cylindrical projected CRSs. These centers are **proposed study locations**, not scientifically pre-approved footprints. Confirm actual source quality at both positions. Edit native resolutions from each source's metadata; the numbers below are **starting scale approximations**, not provenance facts.

```bash
python3 -m science.gis.prepare_pair \
  --earth-dem data/raw/earth/N31W005.hgt \
  --mars-dem data/raw/mars/MEGT-TOPOGRAPHY.img \
  --output-dir data/processed/erfoud-jezero-prep \
  --earth-lat 31.42 --earth-lon -4.24 \
  --mars-lat 18.38 --mars-lon 77.58 \
  --cell-m 1000 --pixels 64 --roughness-cells 3 \
  --earth-source-id YOUR_ACTUAL_NASADEM_GRANULE_ID \
  --earth-source-url https://doi.org/10.5067/MEASURES/NASADEM/NASADEM_HGT.001 \
  --earth-version 001 --earth-native-resolution-m 30 \
  --mars-source-id YOUR_ACTUAL_MOLA_PDS4_PRODUCT_ID \
  --mars-source-url https://pds-geosciences.wustl.edu/missions/mgs/megdr.html \
  --mars-version YOUR_VERIFIED_PDS4_VERSION --mars-native-resolution-m 463
```

This writes `earth-metric.tif`, `mars-metric.tif`, `manifest.json` and `preparation-audit.json` with SHA-256 checksums. **Do not run the example unchanged**: the names and granule identifiers are placeholders. Reject any Mars raster whose `crs` claims Earth WGS84. The tool explicitly refuses to invent missing source CRS information.

Next, **after reviewing the audit, labels and study locations**:

```bash
python3 -m science.gis.cli \
  --manifest data/processed/erfoud-jezero-prep/manifest.json \
  --output-dir data/processed/erfoud-jezero-prep/results
```

The existing Task C engine will validate and compare the two feature sets. Missing cells are retained as missing and cause the analysis status to become incomplete. Review every output and its source provenance before copying any comparison into `frontend/public/comparisons`.

### Verification

```bash
python3 -m unittest discover -s science/gis/tests -v
python3 -m unittest discover -s science/tests -v
```

## Important scientific caveats

- The comparison is a 1-km-scale experimental **terrain** analog index; it is not engineering feasibility, resource discovery, environmental survivability or NASA-approved site certification.
- The bilinear resampling mode is a technical grid transformation. It does not create new instrument observations or fix MOLA gridding/interpolation limitations. Match nominal *effective* analysis scales based on verified source documentation.
- WGS84 / Earth EPSG spatial references are never acceptable for MOLA; the Mars CRS radius and longitude interpretation must match the actual source archive label. This tool checks obvious mislabeling but does not independently prove that the source's vertical datum or identity is correct.
- Until authentic products have been collected and audited, keep the Analysis dashboard's `INCOMPLETE_DATA` display and keep drone scans labeled as a simulation.
