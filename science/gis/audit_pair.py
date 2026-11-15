"""Evidence QA for the Erfoud-Jezero trial; never certifies planetary analog suitability."""
import argparse
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject


def audit(earth_dem, earth_num, earth_swb, mars_dem, prepared_dir):
    prepared = Path(prepared_dir)
    with rasterio.open(earth_dem) as earth, rasterio.open(earth_num) as num, rasterio.open(earth_swb) as swb, rasterio.open(mars_dem) as mars, rasterio.open(prepared / 'earth-metric.tif') as out_e, rasterio.open(prepared / 'mars-metric.tif') as out_m:
        assert earth.shape == num.shape == swb.shape, 'NASADEM companion layer dimensions differ'
        assert earth.transform == num.transform == swb.transform, 'NASADEM companion georeferencing differs'
        assert out_e.width == out_m.width and out_e.height == out_m.height, 'Not matched raster dimensions'
        assert math.isclose(out_e.res[0], out_m.res[0]), 'Not a matched metre-scale grid'
        stats = {}
        for label, original in [('num', num), ('swb', swb)]:
            dst = np.full((out_e.height, out_e.width), 255, dtype=np.uint8)
            reproject(source=rasterio.band(original, 1), destination=dst,
                      src_transform=original.transform, src_crs=original.crs,
                      dst_transform=out_e.transform, dst_crs=out_e.crs,
                      src_nodata=None, dst_nodata=None, resampling=Resampling.nearest)
            stats[label] = {str(k): int(v) for k, v in zip(*np.unique(dst, return_counts=True))}
        mars_valid = float(np.ma.count(mars.read(1, masked=True)) / (mars.width * mars.height))
        return {
            'classification': 'PROVISIONAL_ELEVATION_COMPARISON',
            'grid': {'widthCells': out_e.width, 'heightCells': out_e.height, 'cellMetres': out_e.res[0], 'footprintMetres': [out_e.width*out_e.res[0], out_e.height*out_e.res[1]]},
            'earth': {'source': 'NASADEM_HGT_n31w005', 'nativeCompanionClassCountsAtCoarseCellCenters': stats['num'], 'landWaterFlagCountsAtCoarseCellCenters': stats['swb'], 'numInterpretation': '1–23 = SRTM scene classes per NASADEM guide; not direct count of independent ground observations'},
            'mars': {'source': 'MEGT44N000HB.IMG', 'rawElevationPixelFractionWithValues': mars_valid, 'directShotCoverageKnown': False, 'warning': 'MOLA topography interpolates cells without nadir observations; a non-null raster pixel is not direct-shot evidence'},
            'limitations': ['1 km grids summarize coarse elevation; they are not drone-scale terrain', 'NASADEM heights are geoid-referenced, MOLA topography is relative to Martian areoid: only within-window differences are compared', 'study regions selected around approximate site coordinates, not validated field survey footprints', 'source processing has a resampling and aggregation sensitivity that needs testing', 'scoring-engine READY does not constitute peer-reviewed scientific suitability']}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--earth-dem', required=True)
    p.add_argument('--earth-num', required=True)
    p.add_argument('--earth-swb', required=True)
    p.add_argument('--mars-dem', required=True)
    p.add_argument('--prepared-dir', required=True)
    p.add_argument('--output', required=True)
    a = p.parse_args()
    result = audit(a.earth_dem, a.earth_num, a.earth_swb, a.mars_dem, a.prepared_dir)
    Path(a.output).write_text(json.dumps(result, indent=2) + '\n')
    print('Wrote provisional evidence audit:', a.output)
    print('Earth NUM classes:', result['earth']['nativeCompanionClassCountsAtCoarseCellCenters'])
    print('Mars direct laser-shot coverage: unknown (requires MOLA counts companion)')


if __name__ == '__main__':
    main()
