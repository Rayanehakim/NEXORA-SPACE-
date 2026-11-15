import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const file = fileURLToPath(new URL('../src/components/EchoDroneSimulator.jsx', import.meta.url));
const source = readFileSync(file, 'utf8');
const start = source.indexOf('// TESTABLE_CORE_START');
const end = source.indexOf('// TESTABLE_CORE_END');
assert(start >= 0 && end > start, 'Pure testable core must exist in the single JSX file');
const core = source.slice(start + '// TESTABLE_CORE_START'.length, end);
const { validateDem, slopeDeg, forwardRight, headingToward, resolveTerrain, footprintRadiusM, scanDem } = vm.runInNewContext(`${core}\n({validateDem,slopeDeg,forwardRight,headingToward,resolveTerrain,footprintRadiusM,scanDem})`);
const makeDem = (w = 5, h = 5) => ({ schema: 'echo-void-dem-v1', body: 'earth', width: w, height: h, pixel_size_x_m: 2, pixel_size_y_m: 3, elevations_m: Array.from({length: h}, (_, j) => Array.from({length: w}, (_, i) => 4*i + 3*j)), provenance: { source_url: 'https://example.test/dem' } });
// 1 — full DEM validation, including null cells and explicit rejection of invalid input.
const valid = makeDem(); assert.equal(validateDem(valid), valid);
assert.equal(validateDem({ ...valid, elevations_m: valid.elevations_m.map((r,j) => j === 0 ? [null, ...r.slice(1)] : r) }).width, 5);
for (const patch of [{width: 257}, {body: 'venus'}, {pixel_size_x_m: 0}, {provenance: {}}, {elevations_m: [[1]]}, {schema: 'old'}]) assert.throws(() => validateDem({...valid, ...patch}));
// 2 — tilted plane gradient: dz/dx = 4/2=2; dz/dy = 3/3=1; slope=atan(sqrt(5)).
assert(Math.abs(slopeDeg(valid, 2, 2) - Math.atan(Math.sqrt(5))*180/Math.PI) < 1e-10);
// 3 — nose -Z, 90° left turn (positive yaw) makes forward point -X; right points -Z.
const forward = forwardRight(Math.PI / 2, 1, 0);
assert(Math.abs(forward.x + 1) < 1e-12 && Math.abs(forward.z) < 1e-12);
const right = forwardRight(Math.PI / 2, 0, 1);
assert(Math.abs(right.x) < 1e-12 && Math.abs(right.z + 1) < 1e-12);
assert(Math.abs(headingToward(-8, 0) - Math.PI/2) < 1e-12);
// 4 — invalid import falls back to a validated procedural DEM.
const bad = resolveTerrain({...valid, pixel_size_y_m: -1});
assert.equal(bad.simulated, true); assert.equal(typeof bad.error?.message, 'string'); assert.equal(validateDem(bad.dem), bad.dem);
assert.equal(resolveTerrain(null).simulated, true);
console.log('PASS: DEM validation, plane slope, turned movement, invalid DEM fallback');

// Recon upgrade — footprint scales with AGL and circular scan reads only non-null input cells.
assert(Math.abs(footprintRadiusM(20) - 20 / Math.sqrt(3)) < 1e-10);
assert(footprintRadiusM(40) > footprintRadiusM(20));
const patch = makeDem(5,5); patch.elevations_m[2][2]=null;
const found=scanDem(patch, 2, 2, 4);
assert.equal(found.validCount, found.cells.length);
assert(!found.cells.some(([i,j]) => i===2 && j===2));
assert(found.cells.every(([i,j]) => ((i-2)*2)**2 + ((j-2)*3)**2 <= 16));
assert.equal(found.minElevationM, Math.min(...found.cells.map(([i,j])=>patch.elevations_m[j][i])));
console.log('PASS: circular footprint, no-data exclusion, DEM elevation provenance');

// Task D survey upgrade: bounded back-and-forth path, unique valid-cell coverage,
// excluded missing DEM cells, and a finite route suitable for return-to-home.
const { planSurvey, coverageSummary } = vm.runInNewContext(`${core}\n({planSurvey,coverageSummary})`);
const routeDem = makeDem(49,49);
const plan = planSurvey(routeDem);
assert(plan.waypoints.length >= 4 && plan.waypoints.length % 2 === 0);
assert(plan.valid.size > 0 && plan.areaM2 > 0);
assert(plan.waypoints.every(([x,z]) => x >= plan.bounds.xMin-1e-8 && x <= plan.bounds.xMax+1e-8 && z >= plan.bounds.zMin-1e-8 && z <= plan.bounds.zMax+1e-8));
for (let i = 0; i < plan.waypoints.length; i += 2) {
  const [left,right] = [plan.waypoints[i],plan.waypoints[i+1]];
  assert.equal(left[1],right[1], 'survey pass should be horizontal');
  if (i > 0) assert.equal(Math.sign(right[0]-left[0]), -Math.sign(plan.waypoints[i-1][0]-plan.waypoints[i-2][0]), 'passes should alternate');
}
const firstKey = [...plan.valid][0];
const dup = new Set([firstKey,firstKey,'999:999']);
const one = coverageSummary(plan,dup);
assert.equal(one.surveyedValidCells,1);
assert.equal(one.coverageFraction,1/plan.valid.size);
assert.equal(coverageSummary(plan,new Set(plan.valid)).coverageFraction,1);
const [ni,nj]=firstKey.split(':').map(Number);
routeDem.elevations_m[nj][ni]=null;
const missingPlan=planSurvey(routeDem);
assert(missingPlan.nodata.has(firstKey));
assert(!missingPlan.valid.has(firstKey));
assert(missingPlan.nodata.size >= 1);
assert(coverageSummary(missingPlan,new Set([firstKey])).coverageFraction === 0);
assert(coverageSummary(missingPlan,new Set([firstKey])).unknownFraction > 0);
const tight=planSurvey(makeDem(2,2));
assert(tight.waypoints.every(([x,z]) => Number.isFinite(x) && Number.isFinite(z)));
console.log('PASS: finite lawnmower route, area bounds, duplicate-free coverage, no-data accounting');

// Task D safety upgrade: survey settings alter geometry, simulated battery estimation is
// deterministic, and invalid/steep terrain rejects a path instead of claiming safe flight.
const { estimateEnergyPercent, routeLengthM, validateSurveyRoute, terrainCellRisk, segmentRisk, ENERGY } = vm.runInNewContext(`${core}\n({estimateEnergyPercent,routeLengthM,validateSurveyRoute,terrainCellRisk,segmentRisk,ENERGY})`);
const settingsDem = makeDem(49,49);
const lowSurvey = planSurvey(settingsDem,{altitudeM:12,overlap:.65,areaFraction:.65});
const highSurvey = planSurvey(settingsDem,{altitudeM:72,overlap:.2,areaFraction:.2});
assert(lowSurvey.waypoints.length > highSurvey.waypoints.length, 'lower clearance and greater overlap require more survey passes');
assert(routeLengthM(lowSurvey.waypoints) > routeLengthM(highSurvey.waypoints), 'survey settings must change mission length');
assert(lowSurvey.waypoints.some(([x])=>Math.abs(x)>0), 'path should never degenerate to a zero-length flight');
assert(estimateEnergyPercent(200,20,12) > estimateEnergyPercent(100,20,12));
assert(estimateEnergyPercent(100,20,12) > estimateEnergyPercent(100,20,0));
assert(estimateEnergyPercent(0,20,0) === 0 && ENERGY.reservePercent > 0);
const steepDem=makeDem(9,9);
assert.equal(terrainCellRisk(steepDem,0,0),'STEEP_TERRAIN');
const safeDem={...steepDem,elevations_m:steepDem.elevations_m.map(row=>row.map(()=>4))};
assert.equal(terrainCellRisk(safeDem,0,0),null);
assert.equal(validateSurveyRoute(safeDem,planSurvey(safeDem).waypoints),null);
safeDem.elevations_m[4][4]=null;
assert.equal(terrainCellRisk(safeDem,0,0),'NO_DATA');
assert.equal(segmentRisk(safeDem,[0,0],[4,0]),'NO_DATA');
assert.equal(validateSurveyRoute(safeDem,planSurvey(safeDem).waypoints),'NO_DATA');
console.log('PASS: variable survey settings, simulated energy and reserve, missing/steep DEM safety checks');
