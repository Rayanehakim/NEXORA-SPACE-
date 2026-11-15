import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import type { EchoProps } from '../../types/contracts';
import { toDroneTerrain } from './terrain';
import { createRecorder, type ScanEvent, type SurveySummary } from './recorder';

const Drone = lazy(() => import('../../components/EchoDroneSimulator'));

export function EchoSimulator({site, terrain, onMissionComplete, onMissionReset}: EchoProps & {onMissionReset?:()=>void}) {
  // Changes to site or terrain version restart this session, including the renderer.
  return <EchoSession key={`${site.id}:${terrain.version}`} site={site} terrain={terrain} onMissionComplete={onMissionComplete} onMissionReset={onMissionReset}/>;
}

function EchoSession({site, terrain, onMissionComplete, onMissionReset}: EchoProps & {onMissionReset?:()=>void}) {
  const prepared = useMemo(() => {
    try { return { dem: toDroneTerrain(terrain, site.id), error: null }; }
    catch (error) { return { dem: null, error: error instanceof Error ? error.message : 'Invalid terrain.' }; }
  }, [terrain, site.id]);
  const recorder = useRef(createRecorder(site.id, terrain.version));
  const [error, setError] = useState<string|null>(null);
  const [outcome, setOutcome] = useState<string|null>(null);
  const [scanCount, setScanCount] = useState(0);
  if (prepared.error || !prepared.dem) return <p className="notice" role="alert">ECHO terrain unavailable: {prepared.error} No substitute terrain has been loaded.</p>;
  return <>
    {error && <p className="notice" role="alert">ECHO unavailable: {error}. Analysis and reporting remain accessible.</p>}
    <Suspense fallback={<p role="status">Loading ECHO 3D engine…</p>}>
      <Drone terrain={prepared.dem} onTelemetry={undefined}
        onError={(reason:Error)=>{setError(reason.message);onMissionReset?.()}}
        onScan={(event:ScanEvent)=>{recorder.current.scan(event);setScanCount(recorder.current.count)}}
        onReset={()=>{recorder.current.reset();setScanCount(0);setOutcome(null);onMissionReset?.()}}
        onMissionComplete={(summary:SurveySummary)=>{
          const report = recorder.current.complete(summary);
          setOutcome(report ? 'COMPLETE' : summary.status === 'COMPLETE' ? 'INVALID_REPORT' : summary.status);
          if(report) onMissionComplete(report); else onMissionReset?.();
        }}/>
    </Suspense>
    <p className="panel-caption" role="status">Recorded scans: {scanCount} · Terrain: {terrain.version} · {terrain.sourceType === 'PROCEDURAL' ? 'SIMULATED geometry, not measured site terrain' : `DEM-derived geometry / source ${terrain.provenanceSourceId}; flight remains simulated`}{outcome ? ` · Outcome: ${outcome}${outcome !== 'COMPLETE' ? ' — no completed mission report saved' : ''}` : ''}</p>
  </>;
}
