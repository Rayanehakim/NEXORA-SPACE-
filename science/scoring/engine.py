"""Experimental, deterministic terrain similarity index. No GIS extraction or rankings."""
import json
from pathlib import Path
from .validation import FEATURES, ROOT, number, feature_errors, compatibility_errors, validate_config
from science.gaps.analysis import analog_gaps
from jsonschema import Draft202012Validator

CONFIG = json.loads(Path(__file__).with_name('model-v1.json').read_text(encoding='utf-8-sig'))
validate_config(CONFIG)

def compare(earth, target, profile='terrain_mobility', plan=None):
    if profile not in CONFIG['profiles']:
        raise ValueError('Unsupported mission profile')
    blockers = feature_errors(earth, 'earth', CONFIG) + feature_errors(target, 'target', CONFIG)
    if not blockers:
        blockers.extend(compatibility_errors(earth, target, plan, CONFIG))
    a = earth if isinstance(earth, dict) else {}
    b = target if isinstance(target, dict) else {}
    rows = []
    for feature in FEATURES:
        spec = CONFIG['features'][feature]
        weight = CONFIG['profiles'][profile][feature]
        values = [data.get(feature) for data in (a, b)]
        values = [value if number(value) and value >= 0 and (not feature.endswith('Deg') or value <= 90) else None for value in values]
        distance = min(1.0, abs(values[0] - values[1]) / spec['tolerance']) if not blockers else None
        rows.append(dict(feature=feature, earthValue=values[0], targetValue=values[1], unit=spec['unit'],
                         weight=weight, tolerance=spec['tolerance'], distance=distance,
                         contribution=weight * distance if distance is not None else None))
    provenance = [source for data in (a, b) for source in (data.get('provenance') if isinstance(data.get('provenance'), list) else []) if isinstance(source, dict)]
    evidence = {source.get('evidenceType') for source in provenance if isinstance(source.get('evidenceType'), str)}
    warnings = list(dict.fromkeys(blockers))
    if evidence == {'SIMULATED'}:
        warnings.append('SIMULATED inputs: numeric output is an algorithm demonstration, not a measured candidate result.')
    warnings.append('Experimental model settings are not calibrated NASA thresholds; review independently before scientific use.')
    def region_id(data):
        return data.get('regionId') if isinstance(data.get('regionId'), str) and data['regionId'].strip() else 'unknown'
    result = dict(targetId=region_id(b), earthSiteId=region_id(a), missionProfile=profile,
                  modelVersion=CONFIG['modelVersion'], status='INCOMPLETE_DATA' if blockers else 'READY',
                  score=None if blockers else round(max(0, min(100, 100 * (1 - sum(row['contribution'] for row in rows)))), 8),
                  featureContributions=rows, gaps=analog_gaps(b.get('body'), rows, blockers, evidence,
                      next((source.get('url') for source in provenance if source.get('evidenceType') == 'MEASURED'), None)), evidenceGaps=warnings,
                  sourceIds=sorted({source['sourceId'] for source in provenance if isinstance(source.get('sourceId'), str) and source['sourceId'].strip()}))
    schema = json.loads((ROOT / 'contracts/comparison-result.schema.json').read_text(encoding='utf-8-sig'))
    Draft202012Validator(schema).validate(result)
    return result
