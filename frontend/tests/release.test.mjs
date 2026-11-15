import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {checkRelease} from '../../scripts/check_release.mjs';

function fixture(){const root=mkdtempSync(join(tmpdir(),'nexora-release-test-'));mkdirSync(join(root,'data/evidence'),{recursive:true});mkdirSync(join(root,'frontend/public/comparisons'),{recursive:true});write(root,'science/scoring/model-v1.json',JSON.parse(readFileSync(resolve('../science/scoring/model-v1.json'),'utf8')));return root;}
function write(root,path,data){const file=join(root,path);mkdirSync(resolve(file,'..'),{recursive:true});writeFileSync(file,JSON.stringify(data));return createHash('sha256').update(readFileSync(file)).digest('hex');}
const ledger=releases=>({version:'nexora-reviewed-evidence-v1',releases});
test('prototype build allows no published scientific scores',async()=>{
 const root=fixture();try{write(root,'data/evidence/releases.json',ledger([]));assert.equal((await checkRelease(root)).mode,'PROTOTYPE_NO_PUBLISHED_SCORES')}finally{rmSync(root,{recursive:true,force:true})}
});
test('unreviewed public files and approvals without public artifacts block release',async()=>{
 const root=fixture();try{
  write(root,'data/evidence/releases.json',ledger([]));write(root,'frontend/public/comparisons/pending.json',{status:'READY',score:100});
  await assert.rejects(checkRelease(root),/no scientific review/);
  write(root,'data/evidence/releases.json',ledger([{file:'comparisons/missing.json'}]));await assert.rejects(checkRelease(root),/missing reviewed/);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('review requires verification flags, exact hashes and measured rather than synthetic inputs',async()=>{
 const root=fixture();try{
  const earth=JSON.parse(readFileSync(resolve('../science/scoring/examples/synthetic-earth.json'),'utf8'));
  const target=JSON.parse(readFileSync(resolve('../science/scoring/examples/synthetic-mars.json'),'utf8'));
  const plan=JSON.parse(readFileSync(resolve('../science/scoring/examples/synthetic-plan.json'),'utf8'));
  const result=JSON.parse(readFileSync(resolve('../science/scoring/examples/synthetic-result.json'),'utf8'));
  const file=`comparisons/${earth.regionId}--${target.regionId}--${result.missionProfile}.json`;
  const sha256=write(root,'frontend/public/'+file,result);
  const inputs={};for(const [key,value] of Object.entries({earth,target,plan})){const path=`data/evidence/test-only/${key}.json`;inputs[key]={path,sha256:write(root,path,value)}}
  const entry={file,sha256,inputs,review:{approvedBy:'UNIT TEST ONLY',approvedAt:'2026-11-15T00:00:00Z',sourceLabelsVerified:false,measurementsReproduced:false,limitationsReviewed:false}};
  write(root,'data/evidence/releases.json',ledger([entry]));await assert.rejects(checkRelease(root),/Incomplete scientific review/);
  entry.review.sourceLabelsVerified=entry.review.measurementsReproduced=entry.review.limitationsReviewed=true;
  entry.sha256='0'.repeat(64);write(root,'data/evidence/releases.json',ledger([entry]));await assert.rejects(checkRelease(root),/artifact hash/);
  entry.sha256=sha256;write(root,'data/evidence/releases.json',ledger([entry]));await assert.rejects(checkRelease(root),/measured input pair/);
  write(root,inputs.earth.path,{...earth,relabeled:'tampered'});await assert.rejects(checkRelease(root),/Input hash/);
 }finally{rmSync(root,{recursive:true,force:true})}
});
