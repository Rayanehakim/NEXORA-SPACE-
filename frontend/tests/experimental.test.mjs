import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {moduleUrl} from './module-loader.mjs';
const {experimentalComparison,isExperimentalComparison}=await import(moduleUrl(resolve('src/features/analysis/experimental.ts')));
const {sites,targets}=await import(moduleUrl(resolve('src/data/fixtures/catalog.ts')));

test('all experimental results are validated, exact-selection Python outputs with an explicit unreviewed identity',()=>{
 for(const entry of [...sites,...targets]){
  assert.equal(entry.dataStatus,'READY');assert.ok(entry.bounds.west<entry.bounds.east);assert.ok(entry.bounds.south<entry.bounds.north);
 }
 for(const site of ['earth-erfoud','earth-atacama','earth-askja','earth-haughton','earth-mcmurdo'])for(const target of ['mars-jezero','moon-south-pole'])for(const profile of ['terrain_mobility','geological_survey']){
  const result=experimentalComparison(target,site,profile);
  assert.equal(result.status,'READY');assert.ok(Number.isFinite(result.score));assert.equal(result.earthSiteId,site);assert.equal(result.targetId,target);assert.equal(result.missionProfile,profile);
  assert.equal(isExperimentalComparison(result),true);assert.equal(isExperimentalComparison({...result,score:result.score+.1}),false);
 }
 assert.equal(experimentalComparison('mars-jezero','unknown','terrain_mobility'),null);
 assert.equal(experimentalComparison('mars-jezero','earth-erfoud','invalid-profile'),null);
 assert.equal(isExperimentalComparison(null),false);
 assert.ok(Math.abs(experimentalComparison('mars-jezero','earth-erfoud','terrain_mobility').score-83.66074987)<1e-8);
});
