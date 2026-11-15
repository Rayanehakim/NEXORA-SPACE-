import { EvidenceQuality, evidenceForSelection } from '../analysis/evidence';
import { Link } from 'react-router-dom';
import type { MissionProfile, ReportProps, SimulationReport } from '../../types/contracts';
import { parseComparison } from '../analysis/comparisonValidation';
import { fallbackGaps, formatMetric, isReadyComparison } from '../analysis';
import './report.css';
import { usePrintDetails } from './usePrintDetails';

export function makeMissionExport({target,site,comparison,simulation}: ReportProps, objective: MissionProfile) {
  const evidence = comparison && target && site ? parseComparison(comparison,target.id,site.id,objective) : null;
  const usableSimulation = simulation?.simulated === true && simulation.earthSiteId === site?.id ? simulation : null;
  return {
    format:'nexora-mission-brief-v1', generatedAt:new Date().toISOString(),
    selection:{targetId:target?.id ?? null,targetName:target?.name ?? null,planet:target?.body ?? null,
      siteId:site?.id ?? null,siteName:site?.name ?? null,objective},
    comparison: evidence ?? {status:'INCOMPLETE_DATA',score:null,featureContributions:[],gaps:fallbackGaps(target?.body ?? 'mars'),evidenceGaps:['No validated comparison result for the selected pair'],sourceIds:[]},
    simulation:usableSimulation,
    terrainEvidenceQA: evidenceForSelection(site?.id,target?.id),
    disclosures:[
      'Experimental similarity index, where available, is not planetary equivalence or mission success probability.',
      'ECHO flight, coverage and observations are simulated, not measured terrain evidence.',
      'Planetary environmental conditions and real flight certification are not reproduced.',
      ...(evidenceForSelection(site?.id,target?.id) ? ['Provisional QA values are a prior snapshot; original source-label verification and reproducibility remain pending.'] : []),
      ...(site?.dataStatus !== 'READY' || target?.dataStatus !== 'READY' ? ['Site or target catalog currently lacks processed validated terrain data.'] : []),
    ],
  };
}

export function exportMissionJson(report: ReturnType<typeof makeMissionExport>) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`nexora-${report.selection.siteId ?? 'site'}-${report.selection.targetId ?? 'target'}-mission.json`;
  document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function SurveyDetails({simulation}: {simulation:SimulationReport | null}) {
  if (!simulation) return <div className="report-empty"><p>No ECHO reconnaissance recorded for this Earth site.</p><Link to="/simulation">Run an ECHO survey ↗</Link></div>;
  return <><div className="survey-stats"><p><strong>{(simulation.scannedFraction*100).toFixed(1)}%</strong>Simulated coverage</p><p><strong>{formatMetric(simulation.distanceTravelledM,'m')}</strong>Simulated distance</p><p><strong>{simulation.observations.length}</strong>Logged observations</p></div>
    <dl className="report-facts"><div><dt>Terrain asset</dt><dd>{simulation.terrainAssetVersion}</dd></div><div><dt>Survey identifier</dt><dd className="report-id">{simulation.missionId}</dd></div></dl>
    <p className="panel-caption">Coverage, route and observations are generated in the simulator. No physical sample or rover performance is inferred.</p></>;
}

export function MissionReport(props:ReportProps & {objective?:MissionProfile}) {
  usePrintDetails();
  const {target,site,comparison,simulation,objective='terrain_mobility'}=props;
  const report = makeMissionExport({target,site,comparison,simulation},objective);
  const data = comparison && target && site ? parseComparison(comparison,target.id,site.id,objective) : null;
  const ready = isReadyComparison(data);
  const provisional = evidenceForSelection(site?.id, target?.id);
  const gaps = data?.gaps?.length ? data.gaps : fallbackGaps(target?.body ?? 'mars');
  return <div className="mission-report">
    <div className="report-toolbar"><span className="data-chip">{ready ? 'EXPERIMENTAL SCIENCE' : 'INCOMPLETE EVIDENCE'}</span><div className="report-buttons"><button type="button" className="button" onClick={()=>exportMissionJson(report)}>Download JSON ↓</button><button type="button" className="button button-secondary" onClick={()=>window.print()}>Print report</button></div></div>
    <EvidenceQuality evidence={provisional} />
    <div className="report-layout"><article className="workspace-panel"><div className="panel-heading"><h2>Mission summary</h2><span className="data-chip">PROTOTYPE</span></div>
      <h3 className="report-pair">{site?.name ?? 'No Earth candidate'} → {target?.name ?? 'No planetary target'}</h3>
      <dl className="report-facts"><div><dt>Objective</dt><dd>{objective.replaceAll('_',' ')}</dd></div><div><dt>Planetary body</dt><dd>{target?.body ?? 'Unknown'}</dd></div><div><dt>Terrain similarity index</dt><dd>{ready ? `${data!.score!.toFixed(1)} / 100` : 'Unavailable'}</dd></div><div><dt>Scientific evidence</dt><dd>{ready ? 'Model output available' : provisional ? 'Provisional NASA terrain QA · no validated index' : 'Incomplete data'}</dd></div></dl>
      <h3>ECHO reconnaissance <span className="data-chip">SIMULATED</span></h3><SurveyDetails simulation={report.simulation} />
    </article><aside className="workspace-panel"><div className="panel-heading"><h2>Evidence and limitations</h2></div>
      <ul className="report-limits">{report.disclosures.map(item=><li key={item}>{item}</li>)}</ul>
      {data?.evidenceGaps?.length ? <div className="selected-brief"><span className="eyebrow">DATA GAPS</span><ul className="report-limits">{data.evidenceGaps.map(x=><li key={x}>{x}</li>)}</ul></div> : null}
      <div className="selected-brief"><span className="eyebrow">DATA PROVENANCE</span><p>{data?.sourceIds?.length ? data.sourceIds.join(' · ') : provisional ? 'NASADEM Earth elevation and MOLA Mars topography/counts are documented in the provisional QA panel above. No validated scoring inputs are attached.' : 'No dataset sources attached to this mission comparison.'}</p></div>
    </aside></div>
    <section className="workspace-panel report-gap-summary"><div className="panel-heading"><h2>Experimental design implications</h2><span className="data-chip">{gaps.length} GAPS</span></div><div className="report-gap-grid">{gaps.map((gap,index)=><article key={`${gap.category}-${index}`}><span className="eyebrow">{gap.category} · {gap.severity}</span><p>{gap.claim}</p><strong>{gap.experimentImplication}</strong></article>)}</div></section>
    <p className="panel-caption">Generated for research planning only. Inspect original source datasets and methods before relying on any quantitative comparison.</p>
  </div>;
}
