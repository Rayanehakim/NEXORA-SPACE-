import type { ComparisonResult, MissionProfile } from '../../types/contracts';

const FEATURES = ['meanSlopeDeg', 'p90SlopeDeg', 'roughnessM', 'reliefM'];
const GAPS = ['PHYSICAL', 'PLANETARY', 'EVIDENCE', 'OPERATIONAL'];
const EVIDENCE = ['MEASURED', 'LITERATURE', 'SIMULATED', 'UNKNOWN'];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-7;
const fraction = (value: unknown): value is number => finite(value) && value >= 0 && value <= 1;
const optionalUrl = (value: unknown) => {
  if (value === null) return true;
  if (!text(value)) return false;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

/** Validate supplied model arithmetic; never generate or substitute a browser score. */
export function parseComparison(input: unknown, targetId: string, earthSiteId: string, profile: MissionProfile): ComparisonResult | null {
  if (!isRecord(input) || !text(targetId) || !text(earthSiteId) || !['terrain_mobility', 'geological_survey'].includes(profile) ||
      input.targetId !== targetId || input.earthSiteId !== earthSiteId || input.missionProfile !== profile ||
      !['READY', 'INCOMPLETE_DATA'].includes(String(input.status)) || !text(input.modelVersion) ||
      !Array.isArray(input.featureContributions) || !Array.isArray(input.gaps) ||
      !Array.isArray(input.evidenceGaps) || !input.evidenceGaps.every(text) ||
      !Array.isArray(input.sourceIds) || !input.sourceIds.every(text) || new Set(input.sourceIds).size !== input.sourceIds.length) return null;

  const seen = new Set<string>();
  let weightTotal = 0;
  let lossTotal = 0;
  for (const row of input.featureContributions) {
    if (!isRecord(row) || !text(row.feature) || !FEATURES.includes(row.feature) || seen.has(row.feature)) return null;
    seen.add(row.feature);
    const slope = row.feature.endsWith('Deg');
    const validValue = (value: unknown) => value === null || (finite(value) && value >= 0 && (!slope || value <= 90));
    if (row.unit !== (slope ? 'deg' : 'm') || !validValue(row.earthValue) || !validValue(row.targetValue) ||
        !fraction(row.weight) || !finite(row.tolerance) || row.tolerance <= 0) return null;
    weightTotal += row.weight;
    if (row.distance === null && row.contribution === null) {
      if (input.status === 'READY') return null;
      continue;
    }
    if (!finite(row.earthValue) || !finite(row.targetValue) || !fraction(row.distance) || !fraction(row.contribution) ||
        !close(row.distance, Math.min(1, Math.abs(row.earthValue - row.targetValue) / row.tolerance)) ||
        !close(row.contribution, row.weight * row.distance)) return null;
    lossTotal += row.contribution;
  }
  const gapCategories = new Set<string>();
  for (const gap of input.gaps) {
    if (!isRecord(gap) || !GAPS.includes(String(gap.category)) || !['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'].includes(String(gap.severity)) ||
        !text(gap.claim) || !text(gap.experimentImplication) || !EVIDENCE.includes(String(gap.evidenceType)) || !optionalUrl(gap.sourceUrl)) return null;
    gapCategories.add(String(gap.category));
  }
  if (input.status === 'READY') {
    if (seen.size !== FEATURES.length || !close(weightTotal, 1) || !finite(input.score) || input.score < 0 || input.score > 100 ||
        !close(input.score, 100 * (1 - lossTotal)) || !input.sourceIds.length ||
        !GAPS.every(category => gapCategories.has(category))) return null;
  } else if (input.score !== null) return null;
  return input as unknown as ComparisonResult;
}
