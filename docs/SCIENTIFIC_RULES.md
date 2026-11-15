# Science and Evidence Integrity

1. **Source metadata required** for any measured feature: dataset ID/version/URL, units, source resolution, spatial window, algorithm, effective scale, coverage and provenance.
2. **Compare compatible terrain metrics.** Match effective resolution and footprint, with body-correct map projection and local horizontal distances in metres. Upsampling coarse pixels adds no detail.
3. **Mean absolute elevation is context-only**, because Earth/Mars/Moon vertical datums differ. Slope, P90 slope, roughness and relief need exact operational definitions.
4. **Model index is not a probability.** `100` on identical synthetic test features is an algorithm check, not proof of planetary equivalence.
5. **Scoring**: `d_i = min(1, |Earth_i - target_i| / tolerance_i)` with pre-declared tolerances; `score=100*(1-sum(w_i*d_i))` if valid and `sum(w)=1`. Missing mandatory features => `INCOMPLETE_DATA` with `null` score. Weights/tolerances versioned before observing ranks.
6. **Four analog gaps**: physical mismatch, non-transferable planetary conditions, evidence gaps and operational constraints. Each has an evidence label and source when known.
7. **Drone**: Earth-based visual simulation. A coarse DEM can inform broad terrain shape, not obstacle-scale geometry, actual drone performance or exact rover traction. Synthetic rocks/hazards must be labeled.
8. **Moon**: conventional rotorcraft cannot fly in lunar vacuum. Never imply this app certifies lunar quadcopter behavior.
9. **Claims**: no NASA-certified safety limits, no invented perchlorate concentrations, no chemical effects from scan pulses, no confirmed new analog discovery without evidence.
10. **Global scope**: catalog famous benchmarks but include a repeatable candidate-selection rule to propose an under-characterized patch; no invented rankings.

For primary background see the team's uploaded 2026 engineering specification v1.0 and its references.
