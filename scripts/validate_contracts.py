#!/usr/bin/env python3
"""Validate examples against JSON Schemas. pip install jsonschema if missing."""
import json
from pathlib import Path
from jsonschema import Draft202012Validator

root = Path(__file__).resolve().parents[1] / 'contracts'
for kind in ('feature-set', 'comparison-result', 'terrain-asset'):
    schema = json.loads((root / f'{kind}.schema.json').read_text())
    data = json.loads(next((root / 'examples').glob(f'{kind}*.json')).read_text())
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(data)
    if kind == 'terrain-asset':
        assert len(data['elevationM']) == data['height']
        assert all(len(row) == data['width'] for row in data['elevationM'])
    if kind == 'comparison-result':
        assert data['score'] is None if data['status'] == 'INCOMPLETE_DATA' else isinstance(data['score'], (int, float))
    print('PASS:', kind)
