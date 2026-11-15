import bundle from '../../data/experimentalComparisons.json';
import type { ComparisonResult, MissionProfile } from '../../types/contracts';
import { parseComparison } from './comparisonValidation';

/** Python results only. No browser-side score calculation or review approval. */
export function experimentalComparison(targetId:string,earthSiteId:string,profile:MissionProfile):ComparisonResult|null {
  if(bundle.version!=='nexora-experimental-comparisons-v1'||bundle.reviewStatus!=='UNREVIEWED'||bundle.scientificallyApproved!==false) return null;
  const matches=bundle.comparisons.filter(record=>record.targetId===targetId&&record.earthSiteId===earthSiteId&&record.missionProfile===profile);
  return matches.length===1?parseComparison(matches[0],targetId,earthSiteId,profile):null;
}

export function isExperimentalComparison(comparison:ComparisonResult|null|undefined) {
  if(!comparison) return false;
  const supplied=experimentalComparison(comparison.targetId,comparison.earthSiteId,comparison.missionProfile);
  return supplied!==null&&JSON.stringify(supplied)===JSON.stringify(comparison);
}
