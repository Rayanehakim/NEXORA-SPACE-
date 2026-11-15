# Shared AI Development Rules — Read Before Prompting Any Coding Tool

Your job is to deliver **one independently testable module**, not rewrite ECHO-VOID ATLAS.

1. Read `docs/TASKS.md`, `docs/DECISIONS.md`, `frontend/src/types/contracts.ts`, and relevant fixtures before coding.
2. **Edit only the directories assigned to your task.** Never edit `frontend/src/app/`, `frontend/src/types/`, `frontend/src/styles/`, `contracts/`, `frontend/package.json` or routing unless you are Task A/integrator.
3. Never generate a second application, router, global CSS reset, independent framework, database, or authentication system.
4. Honor declared TypeScript props and JSON shapes exactly. If blocked, file a contract-change request to integrator; do not silently change types.
5. Use fixtures to develop independently. Do not import from another feature's private files; import shared types only.
6. Scientific numbers must have source, method, units, resolution and a traceable status. Distinguish `MEASURED`, `LITERATURE`, `SIMULATED`, `UNKNOWN`. Never invent measurements or NASA thresholds.
7. The Earth drone survey is simulated. LiDAR-like scanning is a mapping animation, not chemical treatment.
8. Support loading, empty, missing, invalid, failed data states. Do not fabricate a score from missing mandatory features.
9. Keep styles scoped to your module, use shared tokens, avoid global selectors (`body`, `button`, `*` etc.).
10. Request package additions in your handoff and let the integrator apply them. Do not introduce a conflicting React, router or Three.js version.
11. Provide tests or a fixture-based component demo. Run applicable typecheck/build and record what passed/failed.
12. Final handoff: files changed, exported symbols, dependencies, run/test command, screenshot or output, limitations, and any data assumptions.

## Task-specific constraints

- B: `frontend/src/features/explorer/**` only; export `GlobalExplorer`.
- C: `science/scoring/**`, `science/gaps/**`, `science/tests/**` only; CLI emits `ComparisonResult` JSON.
- D: `frontend/src/features/echo/**` only; export `EchoSimulator`.
- E: `frontend/src/features/analysis/**` and `frontend/src/features/report/**` only; export `AnalysisDashboard`, `MissionReport`.
- F: `science/gis/**`, `data/processed/**`, `data/sources/**`, `frontend/public/terrain/**` (generated files) only.
- G: `docs/**`, `tests/e2e/**`, `submission/**`; coordinate app-level changes through A.

### If using Lovable/Bolt

Export ONLY your feature's TSX/CSS/assets. Do not merge its separate generated `package.json`, `App.tsx`, global stylesheet or entire Git history. Feature must accept the existing props and have no hidden app providers.
