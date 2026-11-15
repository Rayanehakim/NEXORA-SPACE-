import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
for(const name of ['window','document','navigator','HTMLElement','Element','SVGElement']) Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.ResizeObserver=class{observe(){} disconnect(){}};
const require=createRequire(import.meta.url);
function compile(relative, replacements={}) {
  const raw=readFileSync(new URL(relative,import.meta.url),'utf8').replace(/^import ['"].*?\.css['"];?\s*$/gm,'');
  let js=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  for(const [name,url] of Object.entries({...Object.fromEntries(['react','react/jsx-runtime','leaflet'].map(name=>[name,pathToFileURL(require.resolve(name)).href])),...replacements})) {
    js=js.replaceAll(`"${name}"`,JSON.stringify(url)).replaceAll(`'${name}'`,JSON.stringify(url));
  }
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
}
const model=compile('../src/features/explorer/model.ts');
const {filterCandidates,isMappable}=await import(model);
const {GlobalExplorer}=await import(compile('../src/features/explorer/index.tsx',{'./model':model}));
const L = (await import(pathToFileURL(require.resolve('leaflet')).href)).default;
const instances=[];
L.Map.addInitHook(function(){ instances.push(this); });
const sites=[
  {id:'earth-one',name:'First desert',country:'Chile',latitude:-24,longitude:-69,environmentType:'Desert',selectionRationale:'Test rationale',datasetIds:[],dataStatus:'INCOMPLETE_DATA',terrainAssetUrl:null},
  {id:'earth-two',name:'Second volcano',country:'Iceland',latitude:65,longitude:-16,environmentType:'Volcanic',selectionRationale:'Second rationale',datasetIds:['test-data'],dataStatus:'READY',terrainAssetUrl:'/test-terrain.json'}
];
async function mount(props) {
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(GlobalExplorer,props))));
  return {host,root,async close(){await act(async()=>root.unmount());host.remove()}};
}
test('filters combine environment, availability and case-insensitive search',()=>{
  assert.deepEqual(filterCandidates(sites,'Desert','INCOMPLETE_DATA','CHILE').map(s=>s.id),['earth-one']);
  assert.equal(filterCandidates(sites,'Desert','READY','').length,0);
  assert.equal(isMappable({...sites[0],latitude:NaN}),false);
  assert.equal(isMappable({...sites[0],latitude:89}),false);
});
test('real Leaflet markers and list clicks emit exact site IDs; strict remount cleans up',async()=>{
  const selected=[];const view=await mount({sites,selectedSiteId:null,selectedPlanet:'mars',onSelectSite:id=>selected.push(id)});
  try {
    assert.equal(view.host.querySelectorAll('.leaflet-container').length,1);
    assert.equal(view.host.querySelectorAll('.ex-map-marker').length,2);
    assert.match(view.host.textContent,/Choose an Earth candidate/);
    const marker=view.host.querySelector('[aria-label="Select Second volcano"]');
    await act(async()=>marker.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
    assert.equal(selected.at(-1),'earth-two');
    await act(async()=>view.host.querySelector('.ex-candidate').click());
    assert.equal(selected.at(-1),'earth-one');
    assert.ok(view.host.querySelector('.leaflet-control-attribution a[href="https://www.openstreetmap.org/copyright"]'));
  } finally {await view.close()}
  assert.equal(document.querySelectorAll('.leaflet-container').length,0);
});
test('environment filters update both map and list without silently changing selection',async()=>{
  const calls=[];const view=await mount({sites,selectedSiteId:'earth-one',selectedPlanet:'moon',onSelectSite:id=>calls.push(id)});
  try {
    const environment=view.host.querySelector('select');environment.value='Volcanic';
    await act(async()=>environment.dispatchEvent(new window.Event('change',{bubbles:true})));
    assert.equal(view.host.querySelectorAll('.ex-map-marker').length,1);
    assert.equal(view.host.querySelectorAll('.ex-candidate').length,1);
    assert.match(view.host.textContent,/outside your current filters/);
    assert.match(view.host.textContent,/MOON MISSION/);
    assert.equal(calls.length,0);
    const status=view.host.querySelectorAll('select')[1];status.value='INCOMPLETE_DATA';
    await act(async()=>status.dispatchEvent(new window.Event('change',{bubbles:true})));
    assert.match(view.host.textContent,/No candidates match/);
    assert.equal(view.host.querySelectorAll('.ex-map-marker').length,0);
  } finally {await view.close()}
});
test('empty catalog and invalid coordinates remain usable; readiness is explicit',async()=>{
  const empty=await mount({sites:[],selectedSiteId:null,selectedPlanet:'mars',onSelectSite(){}});
  try {assert.match(empty.host.textContent,/No candidate catalog/);assert.equal(empty.host.querySelectorAll('.ex-map-marker').length,0)}finally{await empty.close()}
  const view=await mount({sites:[{...sites[1],latitude:100}],selectedSiteId:'earth-two',selectedPlanet:'mars',onSelectSite(){}});
  try {
    assert.equal(view.host.querySelectorAll('.ex-map-marker').length,0);
    assert.equal(view.host.querySelectorAll('.ex-candidate').length,1);
    assert.match(view.host.textContent,/FEATURE DATA READY/);
    assert.match(view.host.textContent,/Terrain asset linked/);
    assert.match(view.host.textContent,/outside map range/);
  } finally {await view.close()}
});
test('zoom in recenters the selected site while zoom out and Fit candidates retain overview freedom',async()=>{
  const view=await mount({sites,selectedSiteId:'earth-one',selectedPlanet:'mars',onSelectSite(){}});
  const map=instances.at(-1);
  try {
    await act(async()=>map.setView([0,0],3,{animate:false}));
    // Move away without changing zoom, as a user can do by dragging.
    await act(async()=>map.panTo([10,20],{animate:false}));
    await act(async()=>view.host.querySelector('.leaflet-control-zoom-in').click());
    assert.ok(map.getCenter().distanceTo(L.latLng(-24,-69))<1);
    await act(async()=>map.panTo([10,20],{animate:false}));
    await act(async()=>view.host.querySelector('.leaflet-control-zoom-out').click());
    assert.ok(map.getCenter().distanceTo(L.latLng(10,20))<1);
    await act(async()=>map.setZoom(1,{animate:false}));
    await act(async()=>view.host.querySelector('.ex-panel-heading button').click());
    assert.ok(map.getCenter().distanceTo(L.latLng(-24,-69))>1000);
  }finally{await view.close()}
});
after(()=>dom.window.close());
