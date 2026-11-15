import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const text = await readFile('src/data/coveragePlan.json','utf8');
const plan=JSON.parse(text);
test('five Earth sites and both planetary bodies have source discovery plans',()=>{
  assert.equal(Object.keys(plan.earthSources).length,5);
  assert.equal(Object.keys(plan.targetSources).length,2);
  for(const src of [...Object.values(plan.earthSources), ...Object.values(plan.targetSources)]){
    assert.ok(src.dataset && src.searchHint && /^https:\/\//.test(src.collectionUrl));
  }
});
test('both reviewed Mars pairs are provisional and never scored',()=>{
  assert.equal(plan.processedPairs.length,2);
  const pairKeys=plan.processedPairs.map(x=>`${x.earthSiteId}:${x.targetId}`).sort();
  assert.deepEqual(pairKeys,['earth-atacama:mars-jezero','earth-erfoud:mars-jezero']);
  for(const row of plan.processedPairs){
    assert.equal(row.status,'PROVISIONAL_QA');
    assert.equal(row.scorePublished,false);
  }
});
