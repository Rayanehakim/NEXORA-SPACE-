import type { ComparisonResult, MissionProfile } from '../../types/contracts';
const FEATURES = ['meanSlopeDeg','p90SlopeDeg','roughnessM','reliefM'];
const GAPS = ['PHYSICAL','PLANETARY','EVIDENCE','OPERATIONAL'];
const EVIDENCE = ['MEASURED','LITERATURE','SIMULATED','UNKNOWN'];
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const finiteOrNull = (x:unknown) => x === null || (typeof x === 'number' && Number.isFinite(x));

/** Validate external comparison JSON before treating it as scientific evidence. */
export function parseComparison(input: unknown, targetId:string, earthSiteId:string, profile:MissionProfile): ComparisonResult | null {
  if (!isRecord(input) || input.targetId !== targetId || input.earthSiteId !== earthSiteId || input.missionProfile !== profile || !['READY','INCOMPLETE_DATA'].includes(String(input.status)) ||
    typeof input.modelVersion !== 'string' || !finiteOrNull(input.score) || !Array.isArray(input.featureContributions) ||
    !Array.isArray(input.gaps) || !Array.isArray(input.evidenceGaps) || !input.evidenceGaps.every((x:unknown)=>typeof x === 'string') ||
    !Array.isArray(input.sourceIds) || !input.sourceIds.every((x:unknown)=>typeof x === 'string')) return null;
  if (!input.featureContributions.every((x:unknown) => isRecord(x) && FEATURES.includes(String(x.feature)) && finiteOrNull(x.earthValue) && finiteOrNull(x.targetValue) &&
    (x.unit === 'm' || x.unit === 'deg') && typeof x.weight === 'number' && Number.isFinite(x.weight) && x.weight >= 0 &&
    typeof x.tolerance === 'number' && x.tolerance > 0 && Number.isFinite(x.tolerance) && finiteOrNull(x.distance) && finiteOrNull(x.contribution))) return null;
  if (!input.gaps.every((x:unknown) => isRecord(x) && GAPS.includes(String(x.category)) && ['LOW','MEDIUM','HIGH','UNKNOWN'].includes(String(x.severity)) &&
    typeof x.claim === 'string' && typeof x.experimentImplication === 'string' && EVIDENCE.includes(String(x.evidenceType)) && (x.sourceUrl === null || typeof x.sourceUrl === 'string'))) return null;
  if (input.status === 'READY') {
    if (typeof input.score !== 'number' || input.score < 0 || input.score > 100 || input.featureContributions.length !== 4 || input.sourceIds.length === 0 ||
      !FEATURES.every(key=>(input.featureContributions as Record<string,unknown>[]).some((x:Record<string,unknown>)=>x.feature===key && typeof x.earthValue==='number' && typeof x.targetValue==='number' && typeof x.contribution==='number')) ||
      input.featureContributions.some((x:Record<string,unknown>)=>x.earthValue===null || x.targetValue===null || x.contribution===null)) return null;
  } else if (input.score !== null) return null;
  return input as unknown as ComparisonResult;
}

