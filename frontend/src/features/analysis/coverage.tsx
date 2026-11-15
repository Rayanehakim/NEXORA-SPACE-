import plan from '../../data/coveragePlan.json';
import './coverage.css';

export type CoverageStatus = 'PROVISIONAL_QA' | 'NOT_ACQUIRED';
export function coverageForSelection(earthSiteId: string | null | undefined, targetId: string | null | undefined) {
  if (!earthSiteId || !targetId) return null;
  const earth = (plan.earthSources as Record<string, typeof plan.earthSources['earth-erfoud']>)[earthSiteId];
  const target = (plan.targetSources as Record<string, typeof plan.targetSources['mars-jezero']>)[targetId];
  if (!earth || !target) return null;
  const processed = plan.processedPairs.find(row => row.earthSiteId === earthSiteId && row.targetId === targetId);
  return { earth, target, status: (processed?.status ?? 'NOT_ACQUIRED') as CoverageStatus, measured: !!processed, locallyReproduced: processed?.locallyReproduced ?? false };
}

export function EvidenceCoverage({earthSiteId,targetId,compact=false}: {
  earthSiteId: string | null | undefined;
  targetId: string | null | undefined;
  compact?: boolean;
}) {
  const current = coverageForSelection(earthSiteId,targetId);
  if (!current) return null;
  return <section className={`workspace-panel evidence-coverage ${compact?'evidence-coverage-compact':''}`}
    aria-label="Dataset coverage and acquisition status">
    <div className="panel-heading"><h2>{compact?'Dataset coverage':'Data readiness across Earth and planetary sites'}</h2>
      <span className="data-chip">{plan.processedPairs.length} / {Object.keys(plan.earthSources).length * Object.keys(plan.targetSources).length} PAIRS WITH PROVISIONAL QA</span>
    </div>
    <p>{current.measured
      ? current.locallyReproduced ? 'This pair has locally reproduced provisional terrain QA. Provisional model indices are available; independent source and scientific review remain pending.' : 'This pair has a prior provisional snapshot. Original rasters are absent from this checkout and reproduction remains pending; no approved score is published.'
      : 'This selected pair has no measured, matched terrain comparison yet. The sources below are a research acquisition plan—not evidence that measurements have been downloaded.'}</p>
    <div className="coverage-sources">
      <div><strong>Earth source to evaluate</strong><span>{current.earth.dataset}</span><small>{current.earth.searchHint}</small>
        <a href={current.earth.collectionUrl} target="_blank" rel="noopener noreferrer">Find Earth data ↗</a></div>
      <div><strong>Planetary source to evaluate</strong><span>{current.target.dataset}</span><small>{current.target.searchHint}</small>
        <a href={current.target.collectionUrl} target="_blank" rel="noopener noreferrer">Find planetary data ↗</a></div>
    </div>
    {!compact && <p className="panel-caption">{current.earth.note} {current.target.note} Candidate pins are approximate, not validated study boundaries.</p>}
    {!compact && <details className="model-details"><summary>All ten combinations · {plan.processedPairs.filter(pair=>pair.locallyReproduced).length} reproduced trials</summary><div className="qa-metric-wrap"><table className="qa-metrics"><thead><tr><th scope="col">Earth candidate</th><th scope="col">Mars · Jezero</th><th scope="col">Moon · south pole</th></tr></thead><tbody>{Object.keys(plan.earthSources).map(site=><tr key={site}><th scope="row">{site.slice(6).replace('mcmurdo','McMurdo').replace(/^./,letter=>letter.toUpperCase())}</th>{['mars-jezero','moon-south-pole'].map(target=>{const pair=coverageForSelection(site,target);return <td key={target}>{pair?.locallyReproduced?'Reproduced · review pending':pair?.measured?'Prior snapshot · not reproduced':'Missing source rasters'}</td>})}</tr>)}</tbody></table></div><p className="panel-caption">All current trials use matched 5 km squares, 500 m cells and 1500 m roughness windows. Source QA and descriptor extraction are locally reproduced; experimental indices are available for both mission objectives. They remain unreviewed.</p></details>}
  </section>;
}
