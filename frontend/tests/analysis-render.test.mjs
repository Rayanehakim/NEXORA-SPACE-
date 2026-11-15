import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {JSDOM} from 'jsdom';
import {moduleUrl} from './module-loader.mjs';

const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
for(const name of ['window','document','navigator','HTMLElement','Element']) Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {AnalysisDashboard}=await import(moduleUrl(resolve('src/features/analysis/index.tsx')));
const {MissionReport,makeMissionExport}=await import(moduleUrl(resolve('src/features/report/index.tsx')));
const {useComparison}=await import(moduleUrl(resolve('src/features/analysis/useComparison.ts')));
const {ComparisonStatus}=await import(moduleUrl(resolve('src/features/analysis/ComparisonStatus.tsx')));
const {sites,targets}=await import(moduleUrl(resolve('src/data/fixtures/catalog.ts')));
const site=sites.find(site=>site.id==='earth-erfoud'),target=targets.find(target=>target.id==='mars-jezero');
const ready=()=>({targetId:target.id,earthSiteId:site.id,missionProfile:'terrain_mobility',modelVersion:'test-v1',status:'READY',score:90,
  featureContributions:['meanSlopeDeg','p90SlopeDeg','roughnessM','reliefM'].map(feature=>({feature,earthValue:1,targetValue:2,unit:feature.endsWith('Deg')?'deg':'m',weight:.25,tolerance:10,distance:.1,contribution:.025})),
  gaps:['PHYSICAL','PLANETARY','EVIDENCE','OPERATIONAL'].map(category=>({category,severity:'UNKNOWN',claim:'Test gap',experimentImplication:'Test implication',evidenceType:'UNKNOWN',sourceUrl:null})),evidenceGaps:['Experimental test fixture'],sourceIds:['earth-test','mars-test']});
async function mount(element){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const render=async element=>act(async()=>root.render(React.createElement(MemoryRouter,null,element)));await render(element);return {host,render,async close(){await act(async()=>root.unmount());host.remove()}};}
test('analysis renders ready and incomplete states without showing null as zero, and rejects corrupt direct props',async()=>{
  const view=await mount(React.createElement(AnalysisDashboard,{target,site,comparison:null}));
  try{
    assert.equal(view.host.querySelector('.index-readout strong').textContent,'—');
    assert.match(view.host.textContent,/Source verification and reproduction pending/);
    assert.equal(view.host.querySelector('.terrain-evidence-qa').open,false);
    await view.render(React.createElement(AnalysisDashboard,{target,site,comparison:ready()}));
    assert.equal(view.host.querySelector('.index-readout strong').textContent,'90.0');
    assert.match(view.host.textContent,/Index loss/);assert.match(view.host.textContent,/Weights and comparison tolerances/);
    await view.render(React.createElement(AnalysisDashboard,{target,site,comparison:{...ready(),score:99}}));
    assert.equal(view.host.querySelector('.index-readout strong').textContent,'—');
  }finally{await view.close()}
});
test('report renders survey observations, rejects objective mismatches, and downloads a consistent JSON snapshot',async()=>{
  const simulation={earthSiteId:site.id,simulated:true,missionId:'test-mission',terrainAssetVersion:'demo-test',scannedFraction:.5,distanceTravelledM:10,observations:[{sequence:1,xM:2,zM:3,kind:'SIMULATED_SCAN'}]};
  const props={target,site,comparison:ready(),simulation,objective:'terrain_mobility'};
  assert.equal(makeMissionExport(props,'geological_survey').comparison.score,null);
  const view=await mount(React.createElement(MissionReport,props));
  const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL,originalClick=window.HTMLAnchorElement.prototype.click;
  let saved,clicked=false;
  URL.createObjectURL=blob=>{saved=blob;return 'blob:test'};URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=function(){clicked=true};
  try{
    assert.match(view.host.textContent,/90.0 \/ 100/);assert.match(view.host.textContent,/Logged observations/);
    const download=[...view.host.querySelectorAll('button')].find(button=>button.textContent.includes('Download'));
    await act(async()=>download.click());assert.equal(clicked,true);
    const exported=JSON.parse(await saved.text());assert.equal(exported.comparison.score,90);assert.equal(exported.simulation.observations.length,1);
    assert.equal(exported.terrainEvidenceQA.status,'PROVISIONAL_QA');
    const details=view.host.querySelector('.terrain-evidence-qa');assert.equal(details.open,false);
    window.dispatchEvent(new window.Event('beforeprint'));assert.equal(details.open,true);
    window.dispatchEvent(new window.Event('beforeprint'));window.dispatchEvent(new window.Event('afterprint'));assert.equal(details.open,false);
    await view.render(React.createElement(MissionReport,{...props,comparison:null,simulation:{...simulation,earthSiteId:'wrong'}}));
    assert.match(view.host.textContent,/No ECHO reconnaissance recorded/);assert.doesNotMatch(view.host.textContent,/90.0 \/ 100/);
  }finally{URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;window.HTMLAnchorElement.prototype.click=originalClick;await view.close()}
});
function Probe({targetId=target.id,siteId=site.id}){const state=useComparison(targetId,siteId,'terrain_mobility');return React.createElement('div',null,React.createElement('output',null,`${state.status}:${state.comparison?.score??'none'}`),React.createElement(ComparisonStatus,{status:state.status,retry:state.retry}));}
test('comparison loading distinguishes missing, invalid, server/network failure and supports retry',async()=>{
  const originalFetch=globalThis.fetch;let respond;globalThis.fetch=()=>new Promise(resolve=>{respond=resolve});
  const view=await mount(React.createElement(Probe));
  try{
    assert.match(view.host.textContent,/loading:none/);
    await act(async()=>respond(new Response('',{status:404})));assert.match(view.host.textContent,/missing:none/);
    globalThis.fetch=async()=>new Response('{bad json',{status:200});
    await view.render(React.createElement(Probe,{siteId:'earth-atacama'}));assert.match(view.host.textContent,/invalid:none/);
    globalThis.fetch=async()=>new Response('',{status:503});
    await act(async()=>view.host.querySelector('button').click());assert.match(view.host.textContent,/error:none/);
    globalThis.fetch=async()=>new Response(JSON.stringify({...ready(),earthSiteId:'earth-atacama'}),{headers:{'content-type':'application/json'}});
    await act(async()=>view.host.querySelector('button').click());assert.match(view.host.textContent,/ready:90/);
  }finally{globalThis.fetch=originalFetch;await view.close()}
});
test('a stale comparison response cannot leak into another mission selection',async()=>{
  const originalFetch=globalThis.fetch;const requests=[];
  globalThis.fetch=(_url,options)=>new Promise(resolve=>requests.push({resolve,signal:options.signal}));
  const view=await mount(React.createElement(Probe));
  try{
    await view.render(React.createElement(Probe,{siteId:'earth-atacama'}));assert.equal(requests[0].signal.aborted,true);
    await act(async()=>requests[0].resolve(new Response(JSON.stringify(ready()))));assert.match(view.host.textContent,/loading:none/);
    await act(async()=>requests[1].resolve(new Response('',{status:404})));assert.match(view.host.textContent,/missing:none/);
  }finally{globalThis.fetch=originalFetch;await view.close()}
});
after(()=>dom.window.close());
