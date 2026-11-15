"""Run `python -m science.gis.cli --manifest manifest.json --output-dir output`."""
import argparse
import json
from pathlib import Path

from jsonschema import Draft202012Validator
from science.gis.pipeline import build_feature, build_terrain_asset
from science.scoring.engine import compare
from science.scoring.validation import ROOT


def _write(path, data, schema=None):
    if schema:
        validator = Draft202012Validator(json.loads((ROOT / 'contracts' / schema).read_text()))
        validator.validate(data)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, allow_nan=False) + '\n', encoding='utf8')


def run(manifest_path, output_dir):
    manifest_path = Path(manifest_path).resolve()
    spec = json.loads(manifest_path.read_text(encoding='utf8'))
    if not isinstance(spec, dict) or not isinstance(spec.get('regions'), list) or len(spec['regions']) != 2:
        raise ValueError('Manifest needs regions: [Earth, Mars or Moon]')
    earth_cfg, target_cfg = spec['regions']
    if earth_cfg.get('body') != 'earth' or target_cfg.get('body') not in ('mars', 'moon'):
        raise ValueError('Regions must be ordered Earth then Mars or Moon')
    extracted = [build_feature(r, manifest_path.parent) for r in spec['regions']]
    (earth, er, ez, ecell), (target, tr, _, _) = extracted
    plan = dict(version='analysis-plan-v1', definitionsVersion='terrain-descriptors-v1', regions=[er, tr])
    profiles = spec.get('profiles', ['terrain_mobility', 'geological_survey'])
    if not isinstance(profiles, list) or not profiles or any(p not in ('terrain_mobility', 'geological_survey') for p in profiles):
        raise ValueError('Unsupported profiles')
    output_dir = Path(output_dir).resolve()
    _write(output_dir / 'earth-features.json', earth, 'feature-set.schema.json')
    _write(output_dir / 'target-features.json', target, 'feature-set.schema.json')
    _write(output_dir / 'analysis-plan.json', plan)
    for profile in profiles:
        result = compare(earth, target, profile=profile, plan=plan)
        name = f'{earth["regionId"]}--{target["regionId"]}--{profile}.json'
        _write(output_dir / 'comparisons' / name, result, 'comparison-result.schema.json')
    if spec.get('exportEarthTerrain', False):
        _write(output_dir / 'terrain' / f'{earth["regionId"]}.json',
               build_terrain_asset(earth, ez, ecell), 'terrain-asset.schema.json')
    return output_dir


def main():
    parser = argparse.ArgumentParser(description='Task F metre-grid GIS feature extraction')
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--output-dir', required=True, type=Path)
    options = parser.parse_args()
    try:
        print('Wrote Task F results to', run(options.manifest, options.output_dir))
    except (ValueError, OSError, KeyError, TypeError) as exc:
        parser.exit(2, f'Cannot process DEMs: {exc}\n')


if __name__ == '__main__':
    main()
