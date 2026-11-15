# ECHO simulator

Export `EchoSimulator` from `index.tsx` using the shared `EchoProps`. Optional `onMissionReset` clears the parent report. Terrain validation/conversion lives in `terrain.ts`, and synchronous scan/report collection lives in `recorder.ts`.

All flight telemetry is simulated, including flights over DEM-derived geometry. Procedural terrain remains explicitly labelled. The app adapter loads a linked TerrainAsset or supplies deterministic demonstration geometry when no asset is configured. See `docs/TASK_D_HANDOFF.md` for validation, source boundaries and limitations.
