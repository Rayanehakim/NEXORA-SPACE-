import type { AnalogGap } from '../../types/contracts';

/** Assessment labels describe missing review, without inventing a risk rating. */
export function gapAssessmentLabel(gap:AnalogGap):string {
  if(gap.severity!=='UNKNOWN') return `Severity: ${gap.severity.toLowerCase()}`;
  if(gap.category==='EVIDENCE') return 'Review pending';
  if(gap.category==='OPERATIONAL') return 'Not assessed';
  return 'Severity not assessed';
}

export function gapEvidenceLabel(gap:AnalogGap):string {
  if(gap.evidenceType==='MEASURED') return 'Measured terrain';
  if(gap.evidenceType==='LITERATURE') return 'Documented reference';
  if(gap.evidenceType==='SIMULATED') return 'Simulated';
  if(gap.category==='EVIDENCE') return 'Review pending';
  if(gap.category==='OPERATIONAL') return 'Not assessed';
  return 'Not established';
}
