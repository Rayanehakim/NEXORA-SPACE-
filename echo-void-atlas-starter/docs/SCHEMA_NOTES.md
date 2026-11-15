# Schema rules and validation notes

- JSON schemas in `contracts/` target JSON Schema Draft 2020-12. They validate essential structures, not scientific truth.
- Number fields with `null` are missing; 0 is a legitimate numeric value. Code must not substitute one for the other.
- `FeatureSet` requires same scale, footprint, definitions and units before scoring. Schema alone cannot verify geophysical compatibility.
- `ComparisonResult` with `status=INCOMPLETE_DATA` must have `score=null`. If `READY`, score must be finite in [0,100] with all required features present. This relationship is enforced by schema where possible and by runtime tests.
- `TerrainAsset.elevationM` rows must have the same length as width. Check this programmatically. `cellSizeM` is positive. Default is [row=z][column=x], local metres.
- `sourceType=PROCEDURAL` is not NASA elevation data.
- New major contract versions require integrator review and updates to fixtures, schemas and docs simultaneously.
