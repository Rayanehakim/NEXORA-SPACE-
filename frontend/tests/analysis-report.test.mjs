import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';

const source = await readFile(join(process.cwd(), 'src/features/analysis/comparisonValidation.ts'), 'utf8');
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseComparison} = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const features = ['meanSlopeDeg','p90SlopeDeg','roughnessM','reliefM'];
const valid = () => ({
  targetId:'mars-jezero',earthSiteId:'earth-erfoud',missionProfile:'terrain_mobility',modelVersion:'test-model',status:'READY',score:81,
  featureContributions:features.map((feature)=>({feature,earthValue:1,targetValue:2,unit:feature.endsWith('Deg')?'deg':'m',weight:.25,tolerance:10,distance:.1,contribution:.025})),
  gaps:[],evidenceGaps:[],sourceIds:['earth-dem','mars-dem'],
});
const parse=x=>parseComparison(x,'mars-jezero','earth-erfoud','terrain_mobility');
test('valid comparison is accepted for its exact mission selection',()=>{
  assert.equal(parse(valid()).score,81);
  assert.equal(parseComparison(valid(),'moon-south-pole','earth-erfoud','terrain_mobility'),null);
  assert.equal(parseComparison(valid(),'mars-jezero','earth-erfoud','geological_survey'),null);
});
test('absent and forged scoring data cannot become READY',()=>{
  assert.equal(parse(null),null);
  assert.equal(parse({...valid(),score:NaN}),null);
  assert.equal(parse({...valid(),score:1000}),null);
  assert.equal(parse({...valid(),sourceIds:[]}),null);
  assert.equal(parse({...valid(),featureContributions:valid().featureContributions.slice(0,3)}),null);
});
test('incomplete result can contain explicit null metrics but never a score',()=>{
  const incomplete={...valid(),status:'INCOMPLETE_DATA',score:null,sourceIds:[],featureContributions:[]};
  assert.equal(parse(incomplete)?.status,'INCOMPLETE_DATA');
  assert.equal(parse({...incomplete,score:70}),null);
});
test('malformed gap and feature records are rejected',()=>{
  assert.equal(parse({...valid(),gaps:[{category:'FAKE'}]}),null);
  assert.equal(parse({...valid(),featureContributions:[{...valid().featureContributions[0],earthValue:Infinity},...valid().featureContributions.slice(1)]}),null);
});
