"""Export explicitly unreviewed model results from tracked measured baseline inputs."""
import argparse
import json
import hashlib
from pathlib import Path

from jsonschema import Draft202012Validator
from science.scoring.engine import compare
from science.gis.askja_moon import write_json
from science.gis.coverage_plan import SITE_IDS, TARGET_IDS

ROOT=Path(__file__).resolve().parents[2]


def canonical_hash(path):
    value=json.loads(path.read_text(encoding='utf-8-sig'))
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode()).hexdigest()


def generate(root=ROOT):
    root=Path(root)
    schema=json.loads((root/'contracts/comparison-result.schema.json').read_text())
    results=[];inputs=[]
    for site in SITE_IDS:
        for target in TARGET_IDS:
            folder=root/'data/evidence/local-catalog'/(site+'--'+target)
            records={key:folder/name for key,name in [('earth','earth-features.json'),('target','target-features.json'),('plan','analysis-plan.json')]}
            data={key:json.loads(path.read_text(encoding='utf-8-sig')) for key,path in records.items()}
            if data['earth']['regionId']!=site or data['target']['regionId']!=target:
                raise ValueError('Baseline inputs do not match requested selection')
            inputs.append(dict(earthSiteId=site,targetId=target,files={key:dict(path=path.relative_to(root).as_posix(),canonicalSha256=canonical_hash(path)) for key,path in records.items()}))
            for profile in ('terrain_mobility','geological_survey'):
                result=compare(data['earth'],data['target'],profile,data['plan'])
                Draft202012Validator(schema).validate(result)
                if result['status']!='READY':raise ValueError('Experimental baseline is incomplete: '+site+'/'+target)
                results.append(result)
    return dict(version='nexora-experimental-comparisons-v1',reviewStatus='UNREVIEWED',scientificallyApproved=False,
                disclosure='Experimental model indices from locally reproduced measured terrain. Independent source/scientific review pending; not suitability, safety or mission-success probabilities.',
                hashMethod='sorted-compact-ascii-json-sha256',modelCanonicalSha256=canonical_hash(root/'science/scoring/model-v1.json'),inputs=inputs,comparisons=results)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    path=ROOT/'frontend/src/data/experimentalComparisons.json'
    expected=generate()
    if args.check:
        if json.loads(path.read_text(encoding='utf-8-sig'))!=expected:raise ValueError('Experimental model bundle differs from measured inputs; regenerate it')
    else:write_json(path,expected)
    print('PASS: 20 unreviewed experimental comparisons', 'verified' if args.check else 'exported')


if __name__=='__main__':main()
