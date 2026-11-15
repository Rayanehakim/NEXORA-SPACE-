"""Explicitly synthetic fixtures for testing the algorithm, never real-site data."""
import argparse
import json
from copy import deepcopy
from pathlib import Path

def synthetic_pair():
    earth = dict(regionId='synthetic-earth', body='earth', algorithmVersion='synthetic-terrain-v1', scaleM=30,
                 meanSlopeDeg=2, p90SlopeDeg=4, roughnessM=5, reliefM=20, validFraction=1,
                 provenance=[dict(sourceId='synthetic-test-v1', name='SIMULATED algorithm test fixture', url=None,
                                  version='1', nativeResolutionM=30, processingMethod='Synthetic scalar values; no real study area or DEM.', evidenceType='SIMULATED')],
                 dataStatus='READY')
    target = dict(deepcopy(earth), regionId='synthetic-mars', body='mars')
    regions = []
    for data in (earth, target):
        regions.append(dict(regionId=data['regionId'], body=data['body'], bounds=dict(west=0, east=.01, south=0, north=.01),
                            crs='+proj=eqc +datum=WGS84 +units=m' if data['body'] == 'earth' else '+proj=eqc +R=3389500 +units=m',
                            horizontalUnit='m', footprintWidthM=1020, footprintHeightM=1020, roughnessWindowM=90))
    return earth, target, dict(version='analysis-plan-v1', definitionsVersion='terrain-descriptors-v1', regions=regions)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for filename, data in zip(('synthetic-earth.json', 'synthetic-mars.json', 'synthetic-plan.json'), synthetic_pair()):
        (args.output_dir / filename).write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
if __name__ == '__main__': main()
