"""Structural and conservative compatibility checks, independent of scoring."""
import math
import re
from pathlib import Path
import json
from urllib.parse import urlparse
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
FEATURES = ('meanSlopeDeg', 'p90SlopeDeg', 'roughnessM', 'reliefM')

def number(value):
    try:
        return type(value) in (float, int) and math.isfinite(value)
    except OverflowError:
        return False

def finite_json(value):
    if isinstance(value, dict):
        return all(finite_json(item) for item in value.values())
    if isinstance(value, list):
        return all(finite_json(item) for item in value)
    return not isinstance(value, float) or math.isfinite(value)

def schema_errors(data, path, label):
    schema = json.loads(path.read_text(encoding='utf-8-sig'))
    errors = [f"{label}.{'.'.join(map(str, error.absolute_path)) or '<root>'}: {error.message}"
              for error in Draft202012Validator(schema).iter_errors(data)]
    if not finite_json(data):
        errors.append(f'{label}: non-finite numbers are not allowed')
    return sorted(errors)

def validate_config(config):
    if not config.get('modelVersion') or not config.get('definitionsVersion'):
        raise ValueError('Model and definitions versions are required')
    if not number(config.get('minimumValidFraction')) or not 0 < config['minimumValidFraction'] <= 1:
        raise ValueError('Invalid coverage policy')
    if set(config.get('features', {})) != set(FEATURES):
        raise ValueError('Model must declare all four features')
    for name, spec in config['features'].items():
        if not number(spec.get('tolerance')) or spec['tolerance'] <= 0 or spec.get('unit') != ('deg' if name.endswith('Deg') else 'm'):
            raise ValueError('Invalid feature units or tolerance')
    if set(config.get('profiles', {})) != {'terrain_mobility', 'geological_survey'}:
        raise ValueError('Both supported mission profiles are required')
    for weights in config['profiles'].values():
        if set(weights) != set(FEATURES) or any(not number(w) or not 0 <= w <= 1 for w in weights.values()) or not math.isclose(sum(weights.values()), 1, rel_tol=0, abs_tol=1e-12):
            raise ValueError('Profile weights must be finite, nonnegative and sum to one')

def feature_errors(data, label, config):
    errors = schema_errors(data, ROOT / 'contracts/feature-set.schema.json', label)
    if errors:
        return errors
    if not data['regionId'].strip() or not data['algorithmVersion'].strip():
        errors.append(f'{label}: region ID and algorithm version must be nonempty')
    if data['dataStatus'] != 'READY':
        errors.append(f'{label}: features are not READY')
    if data['validFraction'] < config['minimumValidFraction']:
        errors.append(f'{label}: valid coverage below model policy')
    for name in FEATURES:
        value = data[name]
        if not number(value) or value < 0 or (name.endswith('Deg') and value > 90):
            errors.append(f'{label}: {name} is missing or outside physical range')
    if not data['provenance']:
        errors.append(f'{label}: source provenance is required')
    for source in data['provenance']:
        if any(not isinstance(source[key], str) or not source[key].strip() for key in ('sourceId', 'name', 'version', 'processingMethod')):
            errors.append(f'{label}: source identity, version and processing method required')
        if not number(source['nativeResolutionM']) or source['nativeResolutionM'] <= 0:
            errors.append(f'{label}: native source resolution must be positive')
        elif data['scaleM'] < source['nativeResolutionM']:
            errors.append(f'{label}: effective scale cannot be finer than native source resolution')
        if source['evidenceType'] not in ('MEASURED', 'SIMULATED'):
            errors.append(f'{label}: terrain values require MEASURED or SIMULATED provenance')
        if source['evidenceType'] == 'MEASURED':
            try:
                url = urlparse(source['url'] or '')
                valid_url = url.scheme in ('http', 'https') and bool(url.netloc)
            except ValueError:
                valid_url = False
            if not valid_url:
                errors.append(f'{label}: measured source requires an HTTP source URL')
    return errors

def compatibility_errors(earth, target, plan, config):
    errors = []
    if earth['body'] != 'earth' or target['body'] not in ('mars', 'moon'):
        errors.append('Expected Earth features followed by Mars or Moon features')
    if earth['scaleM'] != target['scaleM']:
        errors.append('Effective scales must match')
    if earth['algorithmVersion'] != target['algorithmVersion']:
        errors.append('Processing algorithm versions must match')
    evidence = {p['evidenceType'] for d in (earth, target) for p in d['provenance']}
    if len(evidence) != 1:
        errors.append('Do not mix measured and simulated terrain evidence')
    if plan is None:
        return errors + ['Analysis plan required to verify declared footprints, methods and projections']
    plan_errors = schema_errors(plan, Path(__file__).with_name('analysis-plan.schema.json'), 'plan')
    if plan_errors:
        return errors + plan_errors
    if plan['definitionsVersion'] != config['definitionsVersion']:
        errors.append('Unsupported terrain feature definitions')
    regions = plan['regions']
    for data, region in zip((earth, target), regions):
        if region['regionId'] != data['regionId'] or region['body'] != data['body']:
            errors.append('Plan regions must match input IDs and bodies in Earth then target order')
        bounds = region['bounds']
        if bounds['west'] >= bounds['east'] or bounds['south'] >= bounds['north']:
            errors.append('Study bounds must have positive extent; split antimeridian windows first')
        crs = region['crs']
        if data['body'] == 'earth' and not (re.fullmatch(r'EPSG:\d+', crs) or crs.startswith('+proj=')):
            errors.append('Earth CRS requires an EPSG identifier or explicit projected definition')
        if crs in ('EPSG:4326', 'EPSG:4269') or '+proj=longlat' in crs or '+proj=latlong' in crs:
            errors.append('Geographic degrees cannot be used as local horizontal metres')
        if crs.startswith('+proj=') and '+units=m' not in crs:
            errors.append('Explicit projected definitions must use metre units')
        if data['body'] != 'earth' and not (crs.startswith('IAU:') or (crs.startswith('+proj=') and ('+R=' in crs or ('+a=' in crs and '+b=' in crs)))):
            errors.append('Planetary CRS requires an IAU identifier or explicit planetary radius/axes; Earth EPSG is invalid')
        if region['roughnessWindowM'] > min(region['footprintWidthM'], region['footprintHeightM']):
            errors.append('Roughness window cannot exceed the analysis footprint')
        if region['roughnessWindowM'] < data['scaleM']:
            errors.append('Roughness window cannot be smaller than effective scale')
    for key in ('footprintWidthM', 'footprintHeightM', 'roughnessWindowM'):
        if regions[0][key] != regions[1][key]:
            errors.append(f'Matched {key} required')
    return errors
