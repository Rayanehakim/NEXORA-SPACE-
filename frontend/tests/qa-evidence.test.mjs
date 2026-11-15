import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import ts from 'typescript';

const record=JSON.parse(await readFile(join(process.cwd(),'src/features/analysis/evidenceRecord.json'),'utf8'));
test('QA is explicitly provisional, matched to the correct pair and never supplies a similarity score',()=>{
  assert.equal(record.status,'PROVISIONAL_QA');
  assert.deepEqual(record.selection,{earthSiteId:'earth-erfoud',targetId:'mars-jezero'});
  assert.equal('score' in record,false);
  assert.equal(record.metrics.length,4);
  assert.equal(record.study.scenarios,5);
});
test('direct MOLA counts distinguish native bins from prepared cells',()=>{
  const c=record.counts;
  assert.equal(c.observedNativeCells,1847);
  assert.equal(c.totalNativeCells,4761);
  assert.equal(c.zeroShotNativeCells+c.observedNativeCells,c.totalNativeCells);
  assert.ok(Math.abs(c.observedNativeFraction-c.observedNativeCells/c.totalNativeCells)<1e-12);
  assert.ok(record.caveats.some(x=>x.includes('NOT 1 km')));
});
test('all scenario ranges contain the baseline and all metric values are finite',()=>{
  for(const m of record.metrics){
    for(const body of ['earth','mars']){
      assert.ok(m[body+'Range'][0]<=m[body+'Baseline']);
      assert.ok(m[body+'Range'][1]>=m[body+'Baseline']);
      assert.ok([m[body+'Range'][0],m[body+'Range'][1],m[body+'Baseline']].every(Number.isFinite));
    }
  }
});

test('provisional QA suppresses duplicate unavailable metric table and report retains source disclosure',async()=>{
  const analysis=await readFile(join(process.cwd(),'src/features/analysis/index.tsx'),'utf8');
  const report=await readFile(join(process.cwd(),'src/features/report/index.tsx'),'utf8');
  assert.match(analysis,/provisional && !ready \?/);
  assert.match(analysis,/The NASA terrain measurements are shown once above/);
  assert.match(analysis,/ready \? <Contributions/);
  assert.match(report,/provisional \? 'NASADEM Earth elevation and MOLA Mars topography\/counts/);
  assert.match(report,/Provisional NASA terrain QA/);
});
