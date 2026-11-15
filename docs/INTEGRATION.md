# Exact Integration Steps (Task A)

## 1. On first setup

```bash
cd frontend
npm install
npm run typecheck
npm run build
npm run dev
```

All routes should work. Do not merge feature PRs until this baseline passes.

## 2. Git setup

```bash
git init
# Create initial commit on main
git add . && git commit -m 'chore: contract-first ECHO-VOID starter'
git branch integration
# publish to a GitHub remote you created separately
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
git push -u origin integration
```

Each developer:

```bash
git fetch origin
git switch -c feature/explorer origin/integration
# edit owned files, run checks, commit, push, PR into integration
```

## 3. Feature integration — a single-page-shell owner

The placeholder routes currently reside in `frontend/src/app/Pages.tsx`. When a module is PR-ready, Task A swaps the placeholder import for its public export **only in `Pages.tsx`**. Do not allow features to edit routing or Context.

- B supplies `GlobalExplorer`; wire onSelectSite to `useMission().setEarthSiteId`.
- E supplies `AnalysisDashboard` and `MissionReport`; pass selected target/site + `ComparisonResult` fixture or real result.
- D supplies `EchoSimulator`; pass selected Earth site + matching `TerrainAsset`, store returned `SimulationReport` in mission state.
- C/F are Python pipelines. Their output JSON must be schema-validated before copying into `frontend/public/data` or replacing frontend fixtures.

## 4. Data verification

- `EarthSite.id === FeatureSet.regionId` for Earth features.
- `PlanetaryTarget.id === FeatureSet.regionId` for target features.
- `TerrainAsset.earthSiteId === selected EarthSite.id`.
- `ComparisonResult.earthSiteId` and `.targetId` match current UI mission selection.
- source IDs resolve to source-registry records; measured values never use `SIMULATED` as if observed.
- JSON invalid, missing mandatory metrics or incompatible scale ⇒ `INCOMPLETE_DATA` and score `null`.

## 5. Before every merge

```bash
cd frontend
npm install --no-audit --no-fund
npm run typecheck
npm run build
```

If science changed:

```bash
python -m pytest science/tests
```

Run smoke test: choose Mars, choose site, analysis shows correct site, open simulator, reset works, report includes selected site, Moon mode shows honest `INCOMPLETE_DATA` unless processed.

## 6. Freeze / delivery

No new modules after feature freeze. Test public link in incognito and second device. Record a <=30s demo, prepare fallback screenshots/JSON, complete official submission and **submit for judging** before local deadline.
