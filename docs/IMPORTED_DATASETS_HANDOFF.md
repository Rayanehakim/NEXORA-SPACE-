# Imported terrain datasets: original Askja and Moon trial

Historical first-import record. The UI now uses the matched all-ten-pair catalog; see [current handoff](ALL_COMBINATIONS_HANDOFF.md). The original trial remains reproducible but is superseded.

The five supplied files are compatible with terrain processing. They are raster layers, not five independent candidate databases. Two Copernicus surface-model tiles cover Askja; the three lunar layers provide elevation, observation-count weights and effective resolution. They do not supply geology, temperature or mission-safety validation.

## Implemented

`science/gis/askja_moon.py` checks source coordinate systems and alignment, hashes every input, mosaics the Earth tiles and prepares matched metric windows. It derives slope, roughness and relief with the existing GIS pipeline. Native lunar quality layers are checked separately rather than treated as elevation.

The proposed study uses Askja at 65.03° N, 16.75° W and the Moon at 88.5° S, 0°. Each window is 10.24 km square on a 320 m grid, with a 960 m roughness window. These explicit study centers are trial choices, not optimized candidates or validated landing sites.

Five scenarios test average, bilinear and nearest resampling plus two half-cell shifts. The actual supplied rasters produce complete prepared windows in all scenarios. Lunar effective resolution supports the selected common grid. The UI exposes measured descriptors and scenario ranges in an expandable QA panel when **Moon + Askja** is selected in Analysis or Report; report JSON exports include the same evidence.

## Reproduce

Keep all five original files at repository root with their supplied filenames. Install `science/gis/requirements.txt`, then run:

```powershell
& ./.venv/Scripts/python.exe -m science.gis.askja_moon --input-dir . --output-dir data/processed/askja-moon --snapshot frontend/src/data/importedTerrainEvidence.json
```

The explicit study configuration is `science/gis/examples/askja-moon-study.json`. Small reproduction records are retained in `data/evidence/askja-moon-trial/`: source hashes and metadata, five scenario outputs, baseline descriptors and analysis plan. Large original/prepared rasters and experimental comparison indices remain ignored local files under `data/processed/`. No numerical compatibility score is published.

## Interpretation and remaining work

- Copernicus is a surface model and can contain buildings or vegetation; it is not guaranteed bare-earth terrain.
- LOLA count values may be fractional after tile blending. Positive-bin coverage and weight totals do not represent independent-shot totals or confidence probabilities.
- Effective resolution describes spatial sampling, not elevation accuracy or a safe-flight limit. Processing-sensitivity ranges are not statistical confidence intervals.
- Original release versions and independent product/label verification remain pending. SHA256 records identify the supplied files; they do not authenticate them against an official archive.
- Independent review of study boundaries, geology and terrain descriptors is required before releasing a comparison. Other candidate locations remain unprocessed.
- ECHO retains its existing procedural Earth demonstration terrain. These data do not enable lunar rotorcraft simulation.

Source documentation: [Copernicus DEM](https://doi.org/10.5270/ESA-c5d3d65), [NASA PGDA lunar south-pole products](https://pgda.gsfc.nasa.gov/products/90), [Barker et al. (2023)](https://doi.org/10.3847/psj/acf3e1). Full Copernicus attribution is retained with the generated snapshot and displayed in the UI. No NASA logo or endorsement is used.
