import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const require=createRequire(import.meta.url);
const dataModule=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
function compile(path,replacements={}){
  let code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  for(const [name,url] of Object.entries({...Object.fromEntries(['react','react/jsx-runtime'].map(name=>[name,pathToFileURL(require.resolve(name)).href])),...replacements})) code=code.replaceAll(`'${name}'`,JSON.stringify(url)).replaceAll(`"${name}"`,JSON.stringify(url));
  return dataModule(code);
}
const terrainUrl=compile('../src/features/echo/terrain.ts');
const recorderUrl=compile('../src/features/echo/recorder.ts');
const {createDemoTerrain,validateTerrain,toDroneTerrain}=await import(terrainUrl);
const {createRecorder}=await import(recorderUrl);
const site={id:'earth-test',name:'Test site'};
test('procedural terrain is deterministic and scoped to selected site',()=>{
  const a=createDemoTerrain(site.id);assert.deepEqual(a,createDemoTerrain(site.id));
  assert.equal(a.earthSiteId,site.id);assert.equal(a.sourceType,'PROCEDURAL');
  assert.equal(validateTerrain(a,site.id),a);
  const b=createDemoTerrain('other');assert.equal(b.earthSiteId,'other');
  assert.deepEqual(a.elevationM,b.elevationM); // same demonstration, never a measured landscape
});
test('terrain validation rejects wrong sites, bad grids, dimensions and provenance',()=>{
  const terrain=createDemoTerrain(site.id);
  for(const patch of [{earthSiteId:'other'},{width:257},{height:1},{cellSizeM:0},{sourceType:'UNKNOWN'},{version:''},{elevationM:[[1]]},{sourceType:'DEM_DERIVED',provenanceSourceId:null}]) assert.throws(()=>validateTerrain({...terrain,...patch},site.id));
  const invalid=createDemoTerrain(site.id);invalid.elevationM[0][0]=NaN;
  assert.throws(()=>validateTerrain(invalid,site.id));
  invalid.elevationM[0][0]=null;assert.throws(()=>validateTerrain(invalid,site.id));
});
test('terrain conversion preserves grid spacing, source identity and simulation labels',()=>{
  const terrain=createDemoTerrain(site.id);const dem=toDroneTerrain(terrain,site.id);
  assert.equal(dem.elevations_m,terrain.elevationM);assert.equal(dem.pixel_size_x_m,20);assert.equal(dem.body,'earth');
  assert.equal(dem.provenance.evidence_type,'SIMULATED');
  const measured=toDroneTerrain({...terrain,sourceType:'DEM_DERIVED',provenanceSourceId:'test-dataset'},site.id);
  assert.equal(measured.provenance.evidence_type,'MEASURED');assert.equal(measured.provenance.source_url,'source-id:test-dataset');
  const source=readFileSync(new URL('../src/components/EchoDroneSimulator.jsx',import.meta.url),'utf8');
  const core=source.split('// TESTABLE_CORE_START')[1].split('// TESTABLE_CORE_END')[0];
  const {resolveTerrain}=vm.runInNewContext(`${core}\n({resolveTerrain})`);
  assert.equal(resolveTerrain(dem).simulated,true);assert.equal(resolveTerrain(measured).simulated,false);
  assert.match(source,/height: 480/); // preserve user-requested viewport
});
test('recorder retains last-frame scans, deduplicates and snapshots a completed report',()=>{
  const recorder=createRecorder(site.id,'v-test');
  recorder.scan({scanId:1,positionM:{x:5,z:10}});recorder.scan({scanId:1,positionM:{x:5,z:10}});
  recorder.scan({scanId:2,positionM:{x:6,z:11}});
  const report=recorder.complete({status:'COMPLETE',coverageFraction:.8,distanceM:40});
  assert.equal(report.observations.length,2);assert.equal(report.terrainAssetVersion,'v-test');assert.equal(report.earthSiteId,site.id);assert.equal(report.simulated,true);
  recorder.reset();assert.equal(recorder.count,0);assert.equal(report.observations.length,2);
  assert.equal(recorder.complete({status:'COMPLETE',coverageFraction:0,distanceM:0}).observations.length,0);
});
test('aborted, invalid and non-finite reports are not recorded',()=>{
  const recorder=createRecorder(site.id,'v');
  for(const patch of [{status:'ABORTED'},{status:'LOW_BATTERY'},{coverageFraction:NaN},{coverageFraction:1.1},{distanceM:-1}]) assert.equal(recorder.complete({status:'COMPLETE',coverageFraction:.5,distanceM:10,...patch}),null);
  recorder.scan({scanId:0,positionM:{x:0,z:0}});recorder.scan({scanId:1,positionM:{x:NaN,z:0}});assert.equal(recorder.count,0);
});

const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
for(const key of ['window','document','navigator','HTMLElement','Element']) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const fakeDrone=dataModule('export default function Drone(props){globalThis.__echoProps=props;return null}');
const {EchoSimulator}=await import(compile('../src/features/echo/index.tsx',{'./terrain':terrainUrl,'./recorder':recorderUrl,'../../components/EchoDroneSimulator':fakeDrone}));
test('EchoSimulator forwards supplied terrain and same-frame scans, resets reports and rejects site mismatch',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const reports=[];let resets=0;const terrain=createDemoTerrain(site.id);
  const props={site,terrain,onMissionComplete:report=>reports.push(report),onMissionReset:()=>resets++};
  try{
    await act(async()=>root.render(React.createElement(EchoSimulator,props)));
    assert.equal(globalThis.__echoProps.terrain.elevations_m,terrain.elevationM);
    await act(async()=>{globalThis.__echoProps.onScan({scanId:1,positionM:{x:2,z:3}});globalThis.__echoProps.onMissionComplete({status:'COMPLETE',coverageFraction:.6,distanceM:12})});
    assert.equal(reports.length,1);assert.equal(reports[0].observations.length,1);
    await act(async()=>globalThis.__echoProps.onReset());assert.equal(resets,1);assert.match(host.textContent,/Recorded scans: 0/);
    await act(async()=>globalThis.__echoProps.onMissionComplete({status:'ABORTED',coverageFraction:.3,distanceM:10}));assert.equal(reports.length,1);assert.equal(resets,2);
    await act(async()=>root.render(React.createElement(EchoSimulator,{...props,terrain:{...terrain,earthSiteId:'wrong'}})));
    assert.match(host.textContent,/different Earth candidate/);
  }finally{await act(async()=>root.unmount());host.remove()}
});
after(()=>{delete globalThis.__echoProps;dom.window.close()});
