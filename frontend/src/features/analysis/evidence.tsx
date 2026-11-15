import record from './evidenceRecord.json';
import atacamaRecord from './evidenceAtacama.json';

/** This QA evidence is separate from the validated model ComparisonResult. */
export type TerrainEvidence = typeof record;
export function evidenceForSelection(earthSiteId: string | null | undefined, targetId: string | null | undefined): TerrainEvidence | null {
  return [record, atacamaRecord].find(item => earthSiteId === item.selection.earthSiteId && targetId === item.selection.targetId) ?? null;
}
export const formatQaNumber = (value:number, digits=2) => value.toLocaleString(undefined,{maximumFractionDigits:digits});

export function EvidenceQuality({evidence}:{evidence:TerrainEvidence | null}) {
  if (!evidence) return null;
  const fraction=evidence.counts.observedNativeFraction;
  return <section className="workspace-panel terrain-evidence-qa" aria-label="Provisional NASA terrain evidence">
    <div className="panel-heading"><h2>Real terrain evidence · {evidence.study.earth} ↔ {evidence.study.target}</h2><span className="data-chip">PROVISIONAL QA · NO SCORE</span></div>
    <div className="qa-lead"><div className="qa-number"><strong>{(fraction*100).toFixed(1)}%</strong><span>MOLA bins with ≥1 direct shot</span></div><div className="qa-context"><p><strong>{evidence.counts.observedNativeCells.toLocaleString()} / {evidence.counts.totalNativeCells.toLocaleString()}</strong> native count-grid bins contain observations. This is <strong>not</strong> confidence in terrain accuracy.</p><div className="qa-bar" role="img" aria-label={`${(fraction*100).toFixed(1)}% of native MOLA grid bins have at least one laser observation`}><span style={{width:`${fraction*100}%`}} /></div><p className="panel-caption">{evidence.study.squareKm} × {evidence.study.squareKm} km study squares · {evidence.study.gridResolutionM.toLocaleString()} m prepared cells · {evidence.study.scenarios} processing scenarios</p></div></div>
    <div className="qa-metric-wrap"><table className="qa-metrics"><thead><tr><th>Terrain metric</th><th>{evidence.study.earth.split(",")[0]} baseline</th><th>{evidence.study.target.split(",")[0]} baseline</th><th>Range across scenarios · Earth / Mars</th></tr></thead><tbody>{evidence.metrics.map(m=><tr key={m.id}><th>{m.label}</th><td>{formatQaNumber(m.earthBaseline)} {m.unit}</td><td>{formatQaNumber(m.marsBaseline)} {m.unit}</td><td>{formatQaNumber(m.earthRange[0])}–{formatQaNumber(m.earthRange[1])} / {formatQaNumber(m.marsRange[0])}–{formatQaNumber(m.marsRange[1])} {m.unit}</td></tr>)}</tbody></table></div>
    <p className="qa-warning"><strong>Evidence limitation:</strong> {evidence.caveats[0]} {evidence.caveats[2]}</p>
    <p className="panel-caption">NASADEM elevation · MOLA topography/counts. <a href={evidence.provenance.earthUrl} target="_blank" rel="noopener noreferrer">Earthdata</a> · <a href={evidence.provenance.marsUrl} target="_blank" rel="noopener noreferrer">NASA PDS</a>. Original MOLA count-label verification remains pending. No analog score is published.</p>
  </section>;
}
