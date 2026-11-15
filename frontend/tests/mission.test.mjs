import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Run the actual reducer without adding a second TS runtime dependency.
const source=readFileSync(new URL('../src/app/missionState.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {initialMission,updateMission}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const sites=[{id:'earth-a'},{id:'earth-b'}];
const targets=[{id:'mars-a',body:'mars'},{id:'moon-a',body:'moon'}];
const initial=()=>initialMission(sites,targets);
const apply=(state,action)=>updateMission(state,action,sites,targets);
const report={earthSiteId:'earth-a',simulated:true,scannedFraction:.5,distanceTravelledM:80};

test('planet changes atomically select a compatible target',()=>{
  const state=apply(initial(),{type:'planet',value:'moon'});
  assert.equal(state.planet,'moon');assert.equal(state.targetId,'moon-a');
  assert.equal(state.earthSiteId,'earth-a');
});
test('invalid and cross-planet IDs cannot corrupt mission selection',()=>{
  const state=initial();
  for(const action of [{type:'target',value:'moon-a'},{type:'site',value:'missing'},{type:'planet',value:'venus'},{type:'profile',value:'invalid'}]) assert.equal(apply(state,action),state);
});
test('changing mission settings invalidates a previous survey',()=>{
  const state=apply(initial(),{type:'simulation',value:report});
  assert.equal(state.simulationReport,report);
  for(const action of [{type:'site',value:'earth-b'},{type:'planet',value:'moon'},{type:'profile',value:'geological_survey'}]) assert.equal(apply(state,action).simulationReport,null);
  assert.equal(apply(state,{type:'site',value:'earth-a'}),state);
});
test('stale or invalid survey callbacks are rejected',()=>{
  for(const patch of [{earthSiteId:'earth-b'},{scannedFraction:NaN},{scannedFraction:1.1},{distanceTravelledM:-1},{simulated:false}]) assert.equal(apply(initial(),{type:'simulation',value:{...report,...patch}}).simulationReport,null);
});
test('empty catalogs have an explicit unselected state',()=>{
  const state=initialMission([],[]);assert.equal(state.earthSiteId,null);assert.equal(state.targetId,'');
});
