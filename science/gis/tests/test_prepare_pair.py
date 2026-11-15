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

    def test_bounds_are_inverse_projected_from_actual_earth_and_mars_footprints(self):
        from rasterio.warp import transform, transform_bounds
        for body, lat, lon, projected, geographic in [
            ('earth',31.42,-4.24,'EPSG:32630','EPSG:4326'),
            ('mars',18.38,77.58,MARS_OUTPUT_CRS,'+proj=longlat +R=3396000 +no_defs')]:
            with self.subTest(body=body):
                x,y=transform(geographic,projected,[lon],[lat])
                source=self.raster(body+'-bounds.tif',projected,x[0],y[0])
                output=self.dir/(body+'-bounded.tif')
                report=prepare_one(source,output,body,lat,lon,1000,32)
                with rasterio.open(output) as ds:
                    expected=transform_bounds(ds.crs,geographic,*ds.bounds,densify_pts=21)
                bounds=report['boundsLonLat']
                for name,value in zip(('west','south','east','north'),expected):
                    self.assertAlmostEqual(bounds[name],value,places=9)
                if body=='mars':
                    self.assertGreater(bounds['north']-bounds['south'],.53)

    def test_sensitivity_accepts_atacama_center_and_southern_projection(self):
        from rasterio.warp import transform
        from science.gis.evidence_checks import analyze_sensitivity
        x,y=transform('EPSG:4326','EPSG:32719',[-69.25],[-24.5])
        earth=self.raster('atacama.tif','EPSG:32719',x[0],y[0])
        x,y=transform('+proj=longlat +R=3396000 +no_defs',MARS_OUTPUT_CRS,[77.58],[18.38])
        mars=self.raster('mars-sensitivity.tif',MARS_OUTPUT_CRS,x[0],y[0])
        result=analyze_sensitivity(earth,mars,self.dir/'scenarios',pixels=9,
                                   earth_lat=-24.5,earth_lon=-69.25,earth_crs='EPSG:32719')
        self.assertEqual(result['selection']['earthCenter'],[-69.25,-24.5])
        self.assertEqual(len(result['scenarios']),5)
        with rasterio.open(self.dir/'scenarios/baseline-bilinear-earth.tif') as ds:
            self.assertEqual(ds.crs.to_epsg(),32719)
        self.assertEqual(result['status'],'PROVISIONAL_SENSITIVITY_ONLY')
