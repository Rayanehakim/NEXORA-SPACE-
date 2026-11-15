"""Deterministic demonstration model. Settings are illustrative, not NASA limits."""
import argparse
import json
import math

FEATURES = {'meanSlopeDeg': (0.25, 10, 'deg'), 'p90SlopeDeg': (0.25, 15, 'deg'), 'roughnessM': (0.25, 20, 'm'), 'reliefM': (0.25, 100, 'm')}

def compare(earth, target, profile='terrain_mobility'):
    errors = []
    if earth.get('body') != 'earth' or target.get('body') not in ('mars', 'moon'):
        errors.append('Expected Earth and Mars/Moon feature sets')
    if earth.get('scaleM') != target.get('scaleM') or not isinstance(earth.get('scaleM'), (int, float)) or earth.get('scaleM', 0) <= 0:
        errors.append('Compatible positive effective scale required')
    # Until bounded footprints and processing metadata are supplied, never rank real sites.
    for data in (earth, target):
        if data.get('dataStatus') != 'READY' or not data.get('provenance') or data.get('validFraction') != 1:
            errors.append('Ready, fully covered features with provenance required')
    if earth.get('algorithmVersion') != target.get('algorithmVersion') or not earth.get('algorithmVersion'):
        errors.append('Compatible processing algorithm required')
    rows = []
    for name, (weight, tolerance, unit) in FEATURES.items():
        a, b = earth.get(name), target.get(name)
        valid = all(type(x) in (int, float) and math.isfinite(x) and x >= 0 for x in (a, b))
        if not valid:
            errors.append('Missing or invalid ' + name)
        distance = min(1, abs(a-b)/tolerance) if valid else None
        rows.append(dict(feature=name, earthValue=a if valid else None, targetValue=b if valid else None, unit=unit, weight=weight, tolerance=tolerance, distance=distance, contribution=weight*distance if valid else None))
    gaps = [dict(category=category, severity='UNKNOWN', claim=claim, experimentImplication=implication, evidenceType='UNKNOWN', sourceUrl=None) for category, claim, implication in [
        ('PHYSICAL', 'Index covers only four terrain descriptors.', 'Assess material and obstacle differences separately.'),
        ('PLANETARY', 'Earth rehearsal does not reproduce planetary conditions.', 'No planetary flight validation.'),
        ('EVIDENCE', 'Demonstration tolerances require scientific validation.', 'Do not treat index as probability or equivalence.'),
        ('OPERATIONAL', 'Field access and weather are unassessed.', 'Conduct separate operational review.')]]
    return dict(targetId=target.get('regionId','unknown'), earthSiteId=earth.get('regionId','unknown'), missionProfile=profile, modelVersion='illustrative-v1', status='INCOMPLETE_DATA' if errors else 'READY', score=None if errors else round(100*(1-sum(r['contribution'] for r in rows)), 8), featureContributions=rows, gaps=gaps, evidenceGaps=errors, sourceIds=sorted({p['sourceId'] for d in (earth,target) for p in d.get('provenance',[]) if 'sourceId' in p}))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('earth')
    parser.add_argument('target')
    parser.add_argument('--profile', choices=['terrain_mobility','geological_survey'], default='terrain_mobility')
    args = parser.parse_args()
    with open(args.earth, encoding='utf-8-sig') as stream: earth = json.load(stream)
    with open(args.target, encoding='utf-8-sig') as stream: target = json.load(stream)
    print(json.dumps(compare(earth,target,args.profile), indent=2, allow_nan=False))
if __name__ == '__main__': main()
