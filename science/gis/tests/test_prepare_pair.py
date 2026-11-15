import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

from science.gis.prepare_pair import prepare_one, MARS_OUTPUT_CRS
from science.gis.pipeline import read_metric_geotiff


class PreparePairTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)

    def raster(self, name, crs, center_x, center_y):
        path = self.dir / name
        values = np.arange(128 * 128, dtype='float32').reshape((128, 128))
        with rasterio.open(path, 'w', driver='GTiff', height=128, width=128,
                           count=1, dtype='float32', crs=crs,
                           transform=from_origin(center_x - 64000, center_y + 64000, 1000, 1000),
                           nodata=-9999) as ds:
            ds.write(values, 1)
        return path

    def test_earth_utm_projected_preserves_scale(self):
        from rasterio.warp import transform
        x, y = transform('EPSG:4326', 'EPSG:32630', [-4.24], [31.42])
        source = self.raster('earth.tif', 'EPSG:32630', x[0], y[0])
        output = self.dir / 'earth-output.tif'
        report = prepare_one(source, output, 'earth', 31.42, -4.24, 1000, 32)
        data, cell, crs, _ = read_metric_geotiff(output)
        self.assertEqual(data.shape, (32, 32))
        self.assertEqual(cell, 1000)
        self.assertTrue(crs.is_projected)
        self.assertEqual(report['validFraction'], 1.0)

    def test_mars_native_planetary_crs(self):
        from rasterio.warp import transform
        src_crs = '+proj=longlat +R=3396190 +no_defs'
        x, y = transform(src_crs, MARS_OUTPUT_CRS, [77.58], [18.38])
        source = self.raster('mars.tif', MARS_OUTPUT_CRS, x[0], y[0])
        output = self.dir / 'mars-output.tif'
        report = prepare_one(source, output, 'mars', 18.38, 77.58, 1000, 32)
        self.assertEqual(report['validFraction'], 1.0)
        self.assertEqual(read_metric_geotiff(output)[0].shape, (32, 32))

    def test_reject_earth_crs_on_mars(self):
        source = self.raster('wrong.tif', 'EPSG:4326', 77.58, 18.38)
        with self.assertRaisesRegex(ValueError, 'WGS84|WGS 84'):
            prepare_one(source, self.dir/'output.tif', 'mars', 18.38, 77.58, 1000, 32)

    def test_out_of_coverage_stays_nodata(self):
        source = self.raster('small.tif', 'EPSG:32630', 500000, 3000000)
        report = prepare_one(source, self.dir/'missing.tif', 'earth', 31.42, -4.24, 1000, 32)
        self.assertEqual(report['validFraction'], 0.0)
