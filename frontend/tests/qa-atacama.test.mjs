import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const r=JSON.parse(await readFile('src/features/analysis/evidenceAtacama.json','utf8'));
test('Atacama QA is measured and pair-scoped, but never contains a similarity index',()=>{
  assert.equal(r.status,'PROVISIONAL_QA');
  assert.deepEqual(r.selection,{earthSiteId:'earth-atacama',targetId:'mars-jezero'});
  assert.ok(!('score' in r));
  assert.equal(r.study.squareKm,32);
  assert.equal(r.metrics.length,4);
  assert.equal(r.provenance.earthElevation,'NASADEM_HGT_s25w070');
});
test('Atacama metric bounds contain all baseline values',()=>{
  for(const m of r.metrics) for(const body of ['earth','mars']) {
    assert.ok(m[body+'Range'][0]<=m[body+'Baseline']);
    assert.ok(m[body+'Range'][1]>=m[body+'Baseline']);
    assert.ok(Number.isFinite(m[body+'Baseline']));
  }
  assert.ok(r.caveats.some(x=>x.includes('not a field-validated')));
});
