# Evidence review and public artifact gate

The existing Erfoud and Atacama QA numbers remain historical provisional snapshots. `provisional-review.json` records missing reproduction inputs; `data/sources/catalog-task-f.json` records source references without claiming that original products were independently verified. Do not relabel these records as approved measurements.

Raw large rasters remain outside Git. Preserve lightweight evidence for each future reviewed pair under a named directory here: original product IDs/versions and stable URLs, original and prepared raster hashes, companion labels or exact label references/hashes, preparation manifest/audit, Earth and target FeatureSet files, analysis plan, source-class and count-coverage audits, five-scenario outputs, and independent review notes. Regenerate geographic bounds with the corrected body-specific inverse projection before review. Numeric QA values are not automatically updated because the original inputs are not available in this checkout.

`releases.json` intentionally has no approvals. `frontend` prebuild runs `scripts/check_release.mjs` and rejects public `comparisons/*.json` or `terrain/*.json` without a matching reviewed, hashed ledger entry. The gate also rejects simulated inputs, changed evidence, invalid comparisons and wrong model inputs. CI additionally recomputes approved comparisons using `scripts/validate_release.py` and the sole Python scoring engine. Approval records attest a human review; neither hashes nor software can establish geophysical truth independently.

Future ledger entries use this shape (do not copy placeholder approvals):

```json
{
  "file": "comparisons/EARTH--TARGET--terrain_mobility.json",
  "sha256": "SHA256_OF_PUBLIC_ARTIFACT",
  "review": {
    "approvedBy": "ACTUAL_REVIEWER",
    "approvedAt": "ISO_TIMESTAMP",
    "sourceLabelsVerified": true,
    "measurementsReproduced": true,
    "limitationsReviewed": true
  },
  "inputs": {
    "earth": {"path":"data/evidence/PAIR/earth-features.json","sha256":"SHA256"},
    "target": {"path":"data/evidence/PAIR/target-features.json","sha256":"SHA256"},
    "plan": {"path":"data/evidence/PAIR/analysis-plan.json","sha256":"SHA256"}
  }
}
```

The file must match the selected site/target/profile and the current model. Terrain releases use `terrain/EARTH.json` with the same reviewed input bundle. A deployment with an empty ledger is a legitimate prototype with unavailable similarity scores and procedural ECHO terrain.
