# Deployment preparation

## Build the intended application

Use the complete repository, Node 22.13+ and the locked frontend dependencies:

```sh
npm --prefix frontend ci
npm test
npm run typecheck
npm run build
```

The only output to publish is `frontend/dist`. The root scripts, CI cache path, artifact upload and Python suites target the canonical root trees. The retired nested starter source must not be selected as a host build directory.

For a provider using a project-root setting, choose either repository root with `npm --prefix frontend ci && npm run build`, output `frontend/dist`, or `frontend` with `npm ci && npm run build`, output `dist`. Keep the entire checkout available because frontend prebuild reads the repository's evidence review ledger and shared validator. Host at the domain root; subpath hosting needs additional asset/base configuration and is not verified here.

`frontend/public/_redirects` supplies `/* /index.html 200` for providers supporting Netlify/Cloudflare Pages redirect syntax. Other hosts require an equivalent **fallback**, preserving existing static assets. Direct navigation to `/explore`, `/analysis`, `/simulation` and `/report` must return the app. Missing comparison JSON may return 404 or an HTML fallback; the loader handles either as unavailable evidence, without showing a score.

## CI gates

The science job installs `science/gis/requirements.txt`, runs scoring and GIS regressions, checks shared schemas and recomputes any approved published comparisons. The frontend job depends on science, installs the root frontend lockfile, runs DOM/unit tests and original drone tests, typechecks, and builds. Prebuild independently enforces the artifact review ledger. CI uploads the static output; it does not deploy or submit anything.

Local Python checks on Windows:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s science/tests -v
.\.venv\Scripts\python.exe -m unittest discover -s science/gis/tests -v
.\.venv\Scripts\python.exe scripts/validate_contracts.py
.\.venv\Scripts\python.exe scripts/validate_release.py
```

## Prototype and measured release

A prototype can have an empty release ledger, no scores and procedural ECHO terrain. Provisional QA must stay visibly unverified. Do not mark the prototype as a measured scoring release.

Before publishing a measured score, independently verify original product labels, versions, projection/body parameters and source quality; regenerate outputs with the corrected geographic bounds; preserve exact source/prepared hashes, manifests and sensitivity/count audits; review model suitability; and add the approved immutable artifacts to `data/evidence/releases.json`. Full instructions are in `data/evidence/README.md`. The software approval gate does not perform independent scientific review or authenticate a human reviewer's identity.

## Browser and staging checks still requiring verification

Run the whole scenario twice, starting from a fresh session:

1. Select Mars, choose an Earth site by map and list, zoom out then in, and verify selection/context consistency.
2. Open Analysis, expand provisional evidence, and verify no score is shown without a released comparison. Check missing, failed and invalid fetch behavior.
3. Run and complete an ECHO survey. Test pause, reset, keyboard and touch controls. Its viewing area must remain 480 pixels high. Test a device without usable WebGL and verify useful recovery.
4. Open Report; verify mission/profile/site, observations and simulation labels. Download JSON and inspect it. Print or save as PDF; expanded supporting evidence must be included without clipping, and the on-screen details state must restore afterward.
5. Repeat with the Moon and another candidate; old mission results must not leak into the new selection.
6. Test desktop, a small laptop, mobile and keyboard-only interaction. Keep main text readable; the new page styles do not shrink body text to 11–12 pixels.

After a staging deployment, verify all four deep links directly and after refresh, incognito/public access, planet assets, map attribution/tiles and network-failure states. A local HTTP 200 or jsdom test does not prove visual layout or real WebGL behavior. Record actual device/browser/date and observed result before marking these checks complete.

No staging/public URL or competition submission is created by these source fixes.
