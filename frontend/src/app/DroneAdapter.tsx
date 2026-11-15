import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { EarthSite, SimulationReport, TerrainAsset } from '../types/contracts';
import { sites } from '../data/fixtures/catalog';
import { createDemoTerrain, validateTerrain } from '../features/echo/terrain';

const EchoSimulator = lazy(() => import('../features/echo').then(module => ({default:module.EchoSimulator})));
export function DroneAdapter({siteId,onReport}:{siteId:string;onReport:(value:SimulationReport|null)=>void}) {
  const site = sites.find(candidate=>candidate.id===siteId);
  if(!site) return <p className="notice" role="alert">Choose a valid Earth candidate before opening ECHO.</p>;
  return <TerrainMission key={`${site.id}:${site.terrainAssetUrl??'procedural'}`} site={site} onReport={onReport}/>;
}

function TerrainMission({site,onReport}:{site:EarthSite;onReport:(value:SimulationReport|null)=>void}) {
  const [terrain,setTerrain]=useState<TerrainAsset|null>(()=>site.terrainAssetUrl?null:createDemoTerrain(site.id));
  const [error,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);
  const reportCallback=useRef(onReport);
  reportCallback.current=onReport;
  useEffect(()=>{
    if(!site.terrainAssetUrl) return;
    const controller=new AbortController();
    let active=true;
    setTerrain(null);setError(null);
    async function load(){
      try {
        const response=await fetch(site.terrainAssetUrl!,{signal:controller.signal});
        if(!response.ok) throw Error(`Terrain request failed (${response.status}).`);
        const asset=validateTerrain(await response.json(),site.id);
        if(active) setTerrain(asset);
      } catch(reason) {
        if(active){setError(reason instanceof Error?reason.message:'Terrain request failed.');reportCallback.current(null)}
      }
    }
    void load();
    return ()=>{active=false;controller.abort()};
  },[site.id,site.terrainAssetUrl,retry]);
  if(error) return <div className="notice" role="alert"><p>Unable to load this candidate's terrain: {error} No substitute terrain has been loaded.</p><button type="button" className="button" onClick={()=>setRetry(value=>value+1)}>Retry terrain</button></div>;
  if(!terrain) return <p role="status">Loading selected candidate terrain…</p>;
  return <Suspense fallback={<p role="status">Loading ECHO module…</p>}><EchoSimulator site={site} terrain={terrain} onMissionComplete={onReport} onMissionReset={()=>onReport(null)}/></Suspense>;
}
