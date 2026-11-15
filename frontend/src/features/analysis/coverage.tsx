import plan from '../../data/coveragePlan.json';
import './coverage.css';

export type CoverageStatus = 'PROVISIONAL_QA' | 'NOT_ACQUIRED';
export function coverageForSelection(earthSiteId: string | null | undefined, targetId: string | null | undefined) {
  if (!earthSiteId || !targetId) return null;
  const earth = (plan.earthSources as Record<string, typeof plan.earthSources['earth-erfoud']>)[earthSiteId];
  const target = (plan.targetSources as Record<string, typeof plan.targetSources['mars-jezero']>)[targetId];
  if (!earth || !target) return null;
  const processed = plan.processedPairs.find(row => row.earthSiteId === earthSiteId && row.targetId === targetId);
  return { earth, target, status: (processed?.status ?? 'NOT_ACQUIRED') as CoverageStatus, measured: !!processed };
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
      ? 'This pair has provisional NASA terrain measurements shown above. No validated similarity score is published.'
      : 'This selected pair has no measured, matched terrain comparison yet. The sources below are a research acquisition plan—not evidence that measurements have been downloaded.'}</p>
    <div className="coverage-sources">
      <div><strong>Earth source to evaluate</strong><span>{current.earth.dataset}</span><small>{current.earth.searchHint}</small>
        <a href={current.earth.collectionUrl} target="_blank" rel="noopener noreferrer">Find Earth data ↗</a></div>
      <div><strong>Planetary source to evaluate</strong><span>{current.target.dataset}</span><small>{current.target.searchHint}</small>
        <a href={current.target.collectionUrl} target="_blank" rel="noopener noreferrer">Find planetary data ↗</a></div>
    </div>
    {!compact && <p className="panel-caption">{current.earth.note} {current.target.note} Candidate pins are approximate, not validated study boundaries.</p>}
  </section>;
}
