# ECHO-VOID ATLAS — NEXORA SPACE

**Shared starter for parallel vibecoding.** This is a scaffold with DEMO fixtures and honest pending-data states, **not** a completed NASA-science product.

## Quick start

```bash
cd frontend
npm install
npm run dev
```

Open the local URL shown by Vite. Routes: `/`, `/explore`, `/analysis`, `/simulation`, `/report`.

## Before contributors start

1. Review `docs/DECISIONS.md` together and freeze scope, targets, metric definitions and interface version.
2. Read `docs/AI_HANDOFF.md` and `docs/TASKS.md`.
3. Create `integration` from `main`; each contributor branches off `integration`.
4. Treat `frontend/src/types/contracts.ts` and `contracts/` as centrally owned and frozen.
5. Each contributor must ship **a module working against sample fixtures**, not an entire app.
6. Integration owner runs `npm run typecheck && npm run build` after each PR.

## What this starter actually does

- Working React + Vite + TypeScript shell, navigation, and planet/site/mission selection retained while navigating (in memory, not browser-storage persistence).
- An initial global *textual site catalog* (not yet a Leaflet map), with candidate rationale and no fabricated real measurements.
- All integration hooks/interfaces, placeholder views for science and simulation.
- Mock comparison is marked **INCOMPLETE_DATA**, so fake scores are not displayed as real.
- Procedural test height grid is clearly identified as **SIMULATED**; it does not represent NASA DEM pixels.

## Workstreams

A shell/integration, B explorer, C scientific engine, D drone, E analysis/report UI, F NASA GIS processing, G QA/competition submission. See `docs/TASKS.md`.

## Boundaries

- Shared site/target ID across all layers.
- Earth-based rotor drone only. It is **not** a lunar rotorcraft.
- NASA measurements require actual downloaded/processed source and methodology.
- Missing scientific data => `INCOMPLETE_DATA`, never invented similarity.
- Python outputs are JSON consumed statically by the frontend, or via an optional API added **only after** the offline path works.

This starter is derived from the team's draft ECHO-VOID ATLAS specification v1.0, November 14, 2026. Scientific decisions remain provisional until team approval.

**Note:** Network-limited file generation environment prevented `npm install`; verify `npm run typecheck` and `npm run build` on your local machine before inviting contributors.
