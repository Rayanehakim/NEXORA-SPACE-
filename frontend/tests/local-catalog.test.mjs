import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync('src/data/localCatalogEvidence.json','utf8'));
const coverage=JSON.parse(readFileSync('src/data/coveragePlan.json','utf8'));

test('all ten exact catalog pairs have locally reproduced evidence on identical scales and footprints',()=>{
 assert.equal(catalog.pairs.length,10);
 const keys=catalog.pairs.map(pair=>`${pair.selection.earthSiteId}:${pair.selection.targetId}`).sort();
 assert.deepEqual(keys,Object.keys(coverage.earthSources).flatMap(site=>Object.keys(coverage.targetSources).map(target=>`${site}:${target}`)).sort());
 for(const pair of catalog.pairs){
  assert.equal(pair.study.cellSizeM,500);assert.equal(pair.study.pixels,10);assert.equal(pair.study.footprintWidthM,5000);assert.equal(pair.study.roughnessWindowM,1500);
  assert.equal(pair.earthValidFraction,1);assert.equal(pair.targetValidFraction,1);assert.equal(pair.allScenariosSupported,true);
  assert.equal(pair.scorePublicationApproved,false);assert.equal('score' in pair,false);
  for(const m of pair.metrics)for(const body of ['earth','target']){
   assert.ok(Number.isFinite(m[body+'Baseline']));assert.ok(m[body+'Range'][0]<=m[body+'Baseline']);assert.ok(m[body+'Baseline']<=m[body+'Range'][1]);
  }
  for(const source of pair.sources){assert.match(source.sha256,/^[a-f0-9]{64}$/);assert.equal(source.releaseVersionVerified,false)}
 }
});

test('native laser coverage stays separate from complete prepared rasters, with planet-correct QA',()=>{
 for(const pair of catalog.pairs){
  const qa=pair.targetQuality;
  if(pair.targetBody==='mars'){
   assert.equal(qa.kind,'MOLA');assert.equal(qa.nativeObservedCellFraction,qa.nativeCellsWithAtLeastOneShot/qa.nativeCellCentersInsideWindow);
   assert.ok(qa.nativeObservedCellFraction>0&&qa.nativeObservedCellFraction<1);
   assert.equal(qa.countsSource.sourceSampleBits,8);assert.equal(qa.countsSource.sourceSampleType,'UNSIGNED_INTEGER');
   assert.ok(pair.study.targetCrs.includes('+R=3396000'));assert.equal('effectiveResolutionM' in qa,false);
  }else{
   assert.equal(qa.kind,'LOLA');assert.equal(qa.positiveCountFraction,qa.positiveCountBins/qa.nativeBinCount);
   assert.ok(qa.effectiveResolutionM.max<=500);assert.ok(pair.study.targetCrs.includes('+R=1737400'));
  }
 }
});
