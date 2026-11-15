import json
import math
import tempfile
import unittest
from pathlib import Path

import numpy as np
from rasterio.crs import CRS
from rasterio.transform import from_origin
import rasterio

from science.gis.pipeline import extract_descriptors, build_feature, build_terrain_asset
from science.gis.cli import run

MARS = '+proj=eqc +lat_ts=0 +lon_0=0 +R=3396190 +units=m +no_defs'


class GISTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def tif(self, name, body, data):
        p = self.root / name
        with rasterio.open(p, 'w', driver='GTiff', width=data.shape[1], height=data.shape[0],
                             count=1, dtype='float32', crs='EPSG:32630' if body == 'earth' else MARS,
                             transform=from_origin(500000, 3500000, 30, 30), nodata=-9999) as ds:
            ds.write(data.astype('float32'), 1)
        return p

    def region(self, name, body, data, evidence='SIMULATED'):
        self.tif(name + '.tif', body, data)
        return {'regionId': 'earth-erfoud' if body == 'earth' else 'mars-jezero', 'body': body,
                'raster': name + '.tif', 'crs': 'EPSG:32630' if body == 'earth' else MARS,
                'bounds': {'west': -4.24 if body == 'earth' else 77.0, 'east': -4.23 if body == 'earth' else 77.01,
                           'south': 31.42 if body == 'earth' else 18.3, 'north': 31.43 if body == 'earth' else 18.31},
                'roughnessWindowM': 90,
                'source': {'sourceId': 'test-' + name, 'name': 'Synthetic unit-test raster',
                           'url': 'https://example.org/UNIT-TEST-NOT-MEASURED' if evidence == 'MEASURED' else None,
                           'version': 'test', 'nativeResolutionM': 30, 'evidenceType': evidence}}

    def test_plane_mean_slope_p90_and_roughness(self):
        y, x = np.mgrid[0:9, 0:9]
        z = 5 * x + 3 * y + 80
        a = extract_descriptors(z, 30, 90)
        self.assertAlmostEqual(a['meanSlopeDeg'], math.degrees(math.atan(math.hypot(5, 3) / 30)), places=10)
        self.assertAlmostEqual(a['p90SlopeDeg'], a['meanSlopeDeg'], places=10)
        self.assertLess(a['roughnessM'], 1e-10)
        self.assertEqual(a['reliefM'], 64)
        self.assertEqual(a['validFraction'], 1)

    def test_nodata_prevents_ready_and_terrain_export(self):
        z = np.ones((9, 9))
        z[4, 4] = -9999
        earth = self.region('earth', 'earth', z)
        f, _, grid, cell = build_feature(earth, self.root)
        self.assertEqual(f['dataStatus'], 'INCOMPLETE_DATA')
        self.assertAlmostEqual(f['validFraction'], 80/81)
        with self.assertRaises(ValueError):
            build_terrain_asset(f, grid, cell)

    def test_full_pipeline_simulated_pair_and_schema(self):
        y, x = np.mgrid[0:9, 0:9]
        earth = self.region('earth', 'earth', 2 * x + 3 * y)
        mars = self.region('mars', 'mars', 4 * x + 5 * y)
        manifest = self.root / 'manifest.json'
        manifest.write_text(json.dumps({'regions': [earth, mars], 'exportEarthTerrain': False}))
        out = self.root / 'result'
        run(manifest, out)
        result = json.loads((out / 'comparisons' / 'earth-erfoud--mars-jezero--terrain_mobility.json').read_text())
        self.assertEqual(result['status'], 'READY')
        self.assertTrue(isinstance(result['score'], float))
        self.assertTrue(any('SIMULATED' in e for e in result['evidenceGaps']))
        f = json.loads((out / 'earth-features.json').read_text())
        self.assertEqual(f['provenance'][0]['evidenceType'], 'SIMULATED')
        with self.assertRaises(ValueError):
            build_terrain_asset(f, np.asarray(2 * x + 3 * y), 30)

    def test_reject_wrong_planetary_crs_and_finer_scale(self):
        z = np.ones((9, 9))
        region = self.region('mars', 'mars', z)
        region['crs'] = 'EPSG:32630'
        with self.assertRaises(ValueError):
            build_feature(region, self.root)
        region['crs'] = MARS
        region['source']['nativeResolutionM'] = 100
        with self.assertRaises(ValueError):
            build_feature(region, self.root)

    def test_reject_mismatched_grids_and_evidence(self):
        z = np.ones((9, 9))
        earth = self.region('earth', 'earth', z)
        mars = self.region('mars', 'mars', z, evidence='MEASURED')
        file = self.root / 'manifest.json'
        file.write_text(json.dumps({'regions': [earth, mars]}))
        run(file, self.root / 'out')
        result = json.loads((self.root / 'out/comparisons/earth-erfoud--mars-jezero--terrain_mobility.json').read_text())
        self.assertIsNone(result['score'])
        self.assertEqual(result['status'], 'INCOMPLETE_DATA')

    def test_nonfinite_or_invalid_windows(self):
        with self.assertRaises(ValueError):
            extract_descriptors(np.ones((9, 9)), 30, 60)
        with self.assertRaises(ValueError):
            extract_descriptors(np.ones((9, 9)), 0, 90)
        with self.assertRaises(ValueError):
            extract_descriptors(np.full((9, 9), np.nan), 30, 90)


if __name__ == '__main__':
    unittest.main()
