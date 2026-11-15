import { EvidenceCoverage } from './coverage';
import { EvidenceQuality, evidenceForSelection } from './evidence';
import type { AnalysisProps, AnalogGap, ComparisonResult, FeatureContribution } from '../../types/contracts';
import './analysis.css';
import { parseComparison } from './comparisonValidation';
import { isExperimentalComparison } from './experimental';
import { ImportedTerrainQuality, importedEvidenceForSelection } from './importedEvidence';

const METRICS = [
  ['meanSlopeDeg', 'Mean slope', 'deg'],
  ['p90SlopeDeg', 'P90 slope', 'deg'],
  ['roughnessM', 'Residual roughness', 'm'],
  ['reliefM', 'Relief', 'm'],
] as const;

const PLANET_GAPS = {
  mars: 'Terrestrial gravity and atmosphere differ from Mars. An Earth reconnaissance cannot validate Martian flight or planetary equivalence.',
  moon: 'The Moon has no substantial atmosphere. Conventional rotorcraft flight on the Moon is not possible.',
};

export function isReadyComparison(value: ComparisonResult | null): boolean {
  return value !== null && value.status === 'READY' && parseComparison(value, value.targetId, value.earthSiteId, value.missionProfile) !== null;
}

export function formatMetric(value: number | null | undefined, unit: string): string {
  return value === null || value === undefined || !Number.isFinite(value) ? 'Unavailable' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;
}

export function fallbackGaps(body: 'mars' | 'moon'): AnalogGap[] {
  return [
    {category:'PHYSICAL',severity:'UNKNOWN',claim:'Terrain mismatch is not yet quantified for a matched pair of bounded regions.',experimentImplication:'Process compatible elevation datasets at the same effective scale.',evidenceType:'UNKNOWN',sourceUrl:null},
    {category:'PLANETARY',severity:'UNKNOWN',claim:PLANET_GAPS[body],experimentImplication:'Treat Earth operations as a rehearsal, not planetary flight validation.',evidenceType:'LITERATURE',sourceUrl:`https://science.nasa.gov/${body}/facts/`},
    {category:'EVIDENCE',severity:'HIGH',claim:'No validated pair of terrain feature sets is available for this selection.',experimentImplication:'Do not calculate an analog ranking from missing measurements.',evidenceType:'UNKNOWN',sourceUrl:null},
    {category:'OPERATIONAL',severity:'UNKNOWN',claim:'Permissions, weather, accessibility, and communications have not been evaluated.',experimentImplication:'Complete a separate location-specific operational assessment.',evidenceType:'UNKNOWN',sourceUrl:null},
  ];
}

function Contributions({ rows }: {rows: FeatureContribution[]}) {
  return <div className="metric-table-wrap"><table className="metric-table">
    <thead><tr><th scope="col">Terrain metric</th><th scope="col">Earth</th><th scope="col">Target</th><th scope="col">Index loss</th></tr></thead>
    <tbody>{METRICS.map(([key, label, unit]) => {
      const row = rows.find(item => item.feature === key);
      return <tr key={key}><th scope="row">{label}</th><td>{formatMetric(row?.earthValue,unit)}</td><td>{formatMetric(row?.targetValue,unit)}</td><td>{row?.contribution === null || row?.contribution === undefined ? '—' : `${(row.contribution*100).toFixed(1)} pts`}</td></tr>;
    })}</tbody>
  </table></div>;
}

export function AnalysisDashboard({target, site, comparison}: AnalysisProps) {
  const data = comparison && target && site ? parseComparison(comparison,target.id,site.id,comparison.missionProfile) : null;
  const ready = isReadyComparison(data);
  const experimental = isExperimentalComparison(data);
  const imported = importedEvidenceForSelection(site?.id,target?.id);
  const provisional = imported ? null : evidenceForSelection(site?.id, target?.id);
  const gaps = data?.gaps?.length ? data.gaps : fallbackGaps(target?.body ?? 'mars');
  return <div className="analysis-dashboard">
    <section className="analysis-overview workspace-panel" aria-label="Comparison summary">
      <div><span className="data-chip">{ready ? experimental ? 'PROVISIONAL MODEL INDEX' : 'EXPERIMENTAL INDEX' : imported ? 'TERRAIN DATA AVAILABLE · NOT SCORED' : 'INCOMPLETE DATA'}</span><h2>{site?.name ?? 'No Earth candidate'} → {target?.name ?? 'No target'}</h2>
        <p>{ready ? 'A model-derived terrain index for a matched pair; it is not planetary equivalence or mission success probability.' : 'A numeric comparison requires validated, bounded terrain feature sets at a compatible scale. Missing values are not zero.'}</p>
        {data?.modelVersion && <p className="evidence-version">Model: {data.modelVersion}</p>}
        {experimental && <p className="panel-caption">Measured terrain inputs, experimental model settings. Independent source and scientific review pending; not a validated analog ranking.</p>}
      </div>
      <div className="index-readout" aria-label="Scientific similarity index"><strong>{ready ? data!.score!.toFixed(1) : '—'}</strong><span>{ready ? 'Experimental index / 100' : 'Index unavailable'}</span></div>
    </section>
    <EvidenceQuality evidence={provisional} />
    <ImportedTerrainQuality earthSiteId={site?.id} targetId={target?.id}/>
    <details className="supporting-evidence"><summary>Dataset acquisition plan</summary><EvidenceCoverage earthSiteId={site?.id} targetId={target?.id} /></details>
    <div className="analysis-layout">
      {(provisional || imported) && !ready ? <section className="workspace-panel model-status" aria-label="Model validation status">
        <div className="panel-heading"><h2>Scientific interpretation</h2><span className="data-chip">NO INDEX</span></div>
        <p>The provisional terrain snapshot is available in the expandable QA panel above. Its source verification, processing and observation-coverage limitations prevent a validated analog ranking at this stage.</p>
        <p className="panel-caption">{provisional ? `The scoring engine remains unchanged. Direct MOLA observations occur in only ${(provisional.counts.observedNativeFraction*100).toFixed(1)}% of native bins; derived metrics vary with resampling.` : 'The supplied Earth and planetary grids have compatible processing support for this trial. Source release versions, surface-model limitations and independent scientific review still gate a published index.'}</p>
      </section> : <section className="workspace-panel"><div className="panel-heading"><h2>Terrain comparison</h2><span className="data-chip">{ready ? 'MODEL OUTPUT' : 'NOT SCORED'}</span></div>
        {ready ? <Contributions rows={data?.featureContributions ?? []} /> : <p>No measured terrain pair is available for this selection. Select an Earth–planet pair with processed elevation data to inspect its provisional NASA terrain measurements.</p>}
        <p className="panel-caption">{ready ? 'Index loss is the number of points subtracted from 100. The model is experimental, not scientifically certified or a measure of planetary equivalence.' : 'No score is generated from incomplete evidence or simulated drone observations.'}</p>
        {ready && <details className="model-details"><summary>Weights and comparison tolerances</summary><div className="metric-table-wrap"><table className="metric-table"><thead><tr><th scope="col">Feature</th><th scope="col">Weight</th><th scope="col">Tolerance</th><th scope="col">Distance</th></tr></thead><tbody>{data!.featureContributions.map(row=><tr key={row.feature}><th scope="row">{METRICS.find(item=>item[0]===row.feature)?.[1]}</th><td>{(row.weight*100).toFixed(0)}%</td><td>{formatMetric(row.tolerance,row.unit)}</td><td>{row.distance?.toFixed(3)??'Unavailable'}</td></tr>)}</tbody></table></div><p className="panel-caption">Project-defined experimental settings, not NASA thresholds. Values and losses are supplied by the Python model; the website does not generate scores.</p></details>}
        {data?.sourceIds?.length ? <div className="evidence-sources"><h3>Source identifiers</h3><p>{data.sourceIds.join(' · ')}</p></div> : null}
      </section>}
      <section className="workspace-panel"><div className="panel-heading"><h2>Analog gap analysis</h2><span className="data-chip">{gaps.length} GAPS</span></div>
        <div className="gap-list">{gaps.map((gap, i) => <article key={`${gap.category}-${i}`}><div><h3>{gap.category}</h3><span className="evidence-severity">{gap.severity}</span></div><div><p>{gap.claim}</p><p className="gap-implication"><strong>Field implication:</strong> {gap.experimentImplication}</p><span className="evidence-kind">Evidence: {gap.evidenceType}</span>{gap.sourceUrl && <p><a href={gap.sourceUrl} target="_blank" rel="noopener noreferrer">Source reference ↗</a></p>}</div></article>)}</div>
      </section>
    </div>
    <section className="workspace-panel evidence-notes"><div className="panel-heading"><h2>Evidence readiness</h2><span className="data-chip">{experimental ? 'SOURCE REVIEW PENDING' : data?.status ?? (imported ? 'TERRAIN QA AVAILABLE' : 'INCOMPLETE_DATA')}</span></div>
      {data?.evidenceGaps?.length ? <ul>{data.evidenceGaps.map((gap, index)=><li key={`${index}-${gap}`}>{gap}</li>)}</ul> : <p>{provisional || imported ? 'A provisional processing snapshot is retained for this pair. Source review is pending; the analog ranking remains disabled.' : 'No validated Earth–planet comparison is loaded. Scientific ranking remains disabled until comparable evidence is available.'}</p>}
      <p className="panel-caption">ECHO drone telemetry and scans are simulated operational outputs; they are not scientific terrain measurements and do not enter the index.</p>
    </section>
  </div>;
}
