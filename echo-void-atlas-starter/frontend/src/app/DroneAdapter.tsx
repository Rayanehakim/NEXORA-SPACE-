import { lazy, Suspense, useState } from 'react';
import type { DroneObservation, SimulationReport } from '../types/contracts';

const Drone = lazy(() => import('../components/EchoDroneSimulator'));
interface Scan { scanId: number; positionM: { x: number; z: number } }
interface Summary { coverageFraction: number; distanceM: number; status: string }

/** Task A boundary: preserve Task D internals and translate its callback payloads. */
export function DroneAdapter({siteId,onReport}:{siteId:string;onReport:(value:SimulationReport|null)=>void}) {
  const [error,setError]=useState<string|null>(null);
  const [observations,setObservations]=useState<DroneObservation[]>([]);
  const [outcome,setOutcome]=useState<string|null>(null);
  return <>
    {error && <p className="notice" role="alert">ECHO unavailable: {error}. Scientific analysis and reporting remain accessible.</p>}
    {outcome && <p role="status">Survey outcome: {outcome}. {outcome !== 'COMPLETE' && 'No completed mission report was recorded.'}</p>}
    <Suspense fallback={<p role="status">Loading ECHO 3D engine…</p>}>
      <Drone onTelemetry={undefined}
        onError={(reason:Error)=>setError(reason.message)}
        onScan={(scan:Scan)=>setObservations(previous=>[...previous,{sequence:scan.scanId,xM:scan.positionM.x,zM:scan.positionM.z,kind:'SIMULATED_SCAN'}])}
        onReset={()=>{setObservations([]);setOutcome(null);onReport(null)}}
        onMissionComplete={(summary:Summary)=>{
          setOutcome(summary.status);
          if(summary.status !== 'COMPLETE'){onReport(null);return}
          onReport({earthSiteId:siteId,terrainAssetVersion:'procedural-demo-v1',missionId:crypto.randomUUID(),
            scannedFraction:summary.coverageFraction,distanceTravelledM:summary.distanceM,observations,simulated:true});
        }}/>
    </Suspense>
  </>;
}
