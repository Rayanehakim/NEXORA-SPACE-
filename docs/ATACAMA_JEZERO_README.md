# Atacama–Jezero: provisional NASADEM/MOLA experiment

Original Earth ZIP: `NASADEM_HGT_s25w070.zip`; contains `s25w070.hgt`, `.num`, `.swb`.
Original Mars product: `MEGT44N000HB.IMG` topography, with the user-provided PDS3 label.

The study windows are **catalog-centered proposals**: Atacama **24.5°S, 69.25°W**, Jezero 18.38°N, 77.58°E. Both are 32 km squares at a 1-km processing scale. Earth uses **EPSG:32719 (UTM zone 19S)**, Mars uses **3396000m radius** from the PDS label, not an Earth datum.

`scenarios.json` contains terrain descriptors in five processing configurations. `atacama-jezero-evidence.json` contains only **provisional QA** values; do not publish a similarity index.

MOLA direct shot bin fraction **38.8%** belongs to the unchanged *Jezero* window and is reused from the previously audited MOLA count product; it is not the fraction of measured 1km prepared cells. Terrain roughness changes with resampling. The NASADEM `.num` and `.swb` support layers are preserved, but the Atacama study-window source-class audit has not yet been completed.

The optional UI patch shows this QA only for **earth-atacama / mars-jezero**, and keeps scoring unavailable. Do not use the trial metrics to claim geological equivalence or permanent-base feasibility.
