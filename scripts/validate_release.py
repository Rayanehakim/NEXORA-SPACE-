"""Recompute reviewed public comparisons with the sole Python scoring implementation."""
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from science.scoring.engine import compare
from jsonschema import Draft202012Validator

def validate(root=ROOT):
    root=Path(root)
    ledger=json.loads((root/'data/evidence/releases.json').read_text(encoding='utf-8-sig'))
    for entry in ledger['releases']:
        artifact=root/'frontend/public'/entry['file']
        payload=json.loads(artifact.read_text(encoding='utf-8-sig'))
        kind='comparison-result' if entry['file'].startswith('comparisons/') else 'terrain-asset'
        schema=json.loads((root/f'contracts/{kind}.schema.json').read_text())
        Draft202012Validator(schema).validate(payload)
        if kind=='comparison-result':
            inputs={key:json.loads((root/item['path']).read_text(encoding='utf-8-sig')) for key,item in entry['inputs'].items()}
            expected=compare(inputs['earth'],inputs['target'],payload['missionProfile'],inputs['plan'])
            if expected['status']!='READY' or payload!=expected:
                raise ValueError(f'Reviewed comparison differs from the scientific engine: {entry["file"]}')
        else:
            if payload['width']>256 or payload['height']>256 or len(payload['elevationM'])!=payload['height'] or any(len(row)!=payload['width'] for row in payload['elevationM']):
                raise ValueError('Published terrain grid must match the renderer contract')
    return len(ledger['releases'])

if __name__=='__main__':
    print('PASS: reviewed scientific artifacts:',validate())
