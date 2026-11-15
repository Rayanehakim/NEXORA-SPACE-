import catalog from '../../data/localCatalogEvidence.json';

export const importedEvidenceRecords = catalog.pairs;
export function importedEvidenceForSelection(earthSiteId:string|null|undefined,targetId:string|null|undefined) {
  return importedEvidenceRecords.find(record=>record.selection.earthSiteId===earthSiteId&&record.selection.targetId===targetId)??null;
}

export function ImportedTerrainQuality({earthSiteId,targetId}:{earthSiteId:string|null|undefined;targetId:string|null|undefined}) {
  const evidence=importedEvidenceForSelection(earthSiteId,targetId);
  if(!evidence) return null;
  const quality=evidence.targetQuality;
  const lunar='positiveCountFraction' in quality;
  const observed=lunar?quality.positiveCountFraction:quality.nativeObservedCellFraction;
  const value=(n:number)=>n.toLocaleString(undefined,{maximumFractionDigits:2});
  return <details className="workspace-panel terrain-evidence-qa imported-terrain-qa" aria-label={`Locally processed ${evidence.earthName} and ${evidence.targetName} terrain QA`}>
    <summary><span><strong>Imported terrain trial · {evidence.earthName} ↔ {evidence.targetName}</strong><span className="qa-review-note">Locally reproduced · independent source-release and scientific review pending</span></span><span className="data-chip">PROVISIONAL · NO SCORE</span></summary>
    <p className="qa-warning">Locally computed terrain descriptors for the selected pair. These proposed study windows are not validated analog or landing sites, and no approved compatibility score is published.</p>
    <div className="imported-quality-grid">
      <div><strong>{value(evidence.study.footprintWidthM/1000)} × {value(evidence.study.footprintWidthM/1000)} km</strong><span>Matched projected study footprints</span></div>
      <div><strong>{evidence.study.cellSizeM} m</strong><span>Common grid · five scenarios</span></div>
      <div><strong>{value((observed??0)*100)}%</strong><span>Native {lunar?'LOLA':'MOLA'} bins with nonzero counts</span></div>
      <div><strong>{lunar?`${value(quality.effectiveResolutionM!.max)} m`:`${quality.nativeCellsWithAtLeastOneShot} / ${quality.nativeCellCentersInsideWindow}`}</strong><span>{lunar?'Largest local effective-resolution value':'Native MOLA bins with recorded observations'}</span></div>
    </div>
    <p className="panel-caption">Earth center: {evidence.study.earthCenter.latitude}°, {evidence.study.earthCenter.longitude}°. Target center: {evidence.study.targetCenter.latitude}°, {evidence.study.targetCenter.longitude}°. Earth analysis CRS: {evidence.study.earthCrs}. The target uses a body-specific metre projection. Roughness window: {evidence.study.roughnessWindowM} m.</p>
    <div className="qa-metric-wrap"><table className="qa-metrics"><thead><tr><th scope="col">Terrain metric</th><th scope="col">{evidence.earthName} baseline</th><th scope="col">{evidence.targetName} baseline</th><th scope="col">Scenario range · Earth / target</th></tr></thead><tbody>{evidence.metrics.map(metric=><tr key={metric.id}><th scope="row">{metric.label}</th><td>{value(metric.earthBaseline)} {metric.unit}</td><td>{value(metric.targetBaseline)} {metric.unit}</td><td>{value(metric.earthRange[0])}–{value(metric.earthRange[1])} / {value(metric.targetRange[0])}–{value(metric.targetRange[1])} {metric.unit}</td></tr>)}</tbody></table></div>
    <p className="panel-caption">Prepared elevation coverage: {(evidence.earthValidFraction*100).toFixed(1)}% Earth / {(evidence.targetValidFraction*100).toFixed(1)}% target. This differs from direct-observation coverage. Baseline uses area averaging; other scenarios test bilinear, nearest and projected half-cell shifts.</p>
    <ul className="qa-caveats">{evidence.limitations.map(limitation=><li key={limitation}>{limitation}</li>)}</ul>
    {evidence.earthQuality && <details className="model-details"><summary>Earth source-quality diagnostics</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(evidence.earthQuality,null,2)}</pre></details>}
    <details className="model-details"><summary>Source files and checksums</summary><ul className="imported-source-list">{evidence.sources.map(source=><li key={source.role}><strong>{source.filename}</strong><span>{source.role} · {source.width} × {source.height}</span><code>SHA256 {source.sha256}</code><a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">Product documentation ↗</a></li>)}</ul></details>
    <p className="panel-caption imported-attribution">{evidence.earthAttribution}. {evidence.targetAttribution}. {evidence.sources.some(source=>source.filename.includes('32m_v'))&&<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">Polar DEM license: CC BY 4.0</a>}</p>
  </details>;
}
