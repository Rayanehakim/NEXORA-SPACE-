"""Synthetic grids test behavior only; they are not additional real measurements."""
import tempfile
import unittest
from pathlib import Path
import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from science.gis.askja_moon import FILES, MOON_PROJECTED, is_lunar_polar, validate_source_grids, mosaic_earth, native_quality, prepare_window, supports_common_scale

class ImportedTerrainTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        self.paths={role:self.root/name for role,name in FILES.items()}
        self.write('earthSouth',np.ones((10,10)),'EPSG:4326',from_origin(-17,65,.1,.1))
        self.write('earthNorth',np.full((10,10),2),'EPSG:4326',from_origin(-17,66,.1,.1))
        for role in ('moonElevation','moonCounts','moonEffectiveResolution'):
            self.write(role,np.ones((16,16)),MOON_PROJECTED,from_origin(-640,640,80,80))

    def write(self,role,values,crs,affine):
        with rasterio.open(self.paths[role],'w',driver='GTiff',height=values.shape[0],width=values.shape[1],count=1,dtype='float32',crs=crs,transform=affine,nodata=np.nan) as ds:
            ds.write(values.astype('float32'),1)

    def test_five_roles_align_and_earth_tiles_mosaic_across_latitude_boundary(self):
        validate_source_grids(self.paths)
        output=mosaic_earth([self.paths['earthSouth'],self.paths['earthNorth']],self.root/'mosaic.tif')
        with rasterio.open(output) as ds:
            self.assertEqual(ds.shape,(20,10));self.assertEqual(ds.bounds.top,66);self.assertEqual(ds.bounds.bottom,64)
            values=ds.read(1);self.assertTrue(np.all(values[:10]==2));self.assertTrue(np.all(values[10:]==1))

    def test_misaligned_lunar_auxiliary_layer_is_rejected(self):
        self.write('moonCounts',np.ones((16,16)),MOON_PROJECTED,from_origin(-560,640,80,80))
        with self.assertRaisesRegex(ValueError,'align exactly'):validate_source_grids(self.paths)

    def test_moon_crs_cannot_be_earth_mars_or_wrong_true_scale_latitude(self):
        self.assertTrue(is_lunar_polar(CRS.from_proj4(MOON_PROJECTED)))
        self.assertTrue(is_lunar_polar(CRS.from_proj4('+proj=stere +lat_0=-90 +lon_0=0 +k=1 +R=1737400 +units=m')))
        for crs in ('EPSG:4326','EPSG:32628','+proj=stere +lat_0=-90 +R=3396000 +units=m','+proj=stere +lat_0=-90 +lat_ts=-89 +R=1737400 +units=m'):
            self.assertFalse(is_lunar_polar(CRS.from_user_input(crs)))

    def test_native_counts_allow_fractional_blend_weights_and_exclude_zero_bins(self):
        counts=np.ones((16,16));counts[8,8]=0;counts[8,9]=2.5
        effective=np.full((16,16),100.0);effective[8,8]=250
        self.write('moonCounts',counts,MOON_PROJECTED,from_origin(-640,640,80,80))
        self.write('moonEffectiveResolution',effective,MOON_PROJECTED,from_origin(-640,640,80,80))
        result=native_quality(self.paths,[-320,-320,320,320])
        self.assertEqual(result['nativeBinCount'],64);self.assertEqual(result['positiveCountBins'],63)
        self.assertEqual(result['positiveCountFraction'],63/64);self.assertEqual(result['countWeightSum'],64.5)
        self.assertEqual(result['effectiveResolutionM']['max'],250)
        self.assertTrue(supports_common_scale(result,320));self.assertFalse(supports_common_scale(result,160))
        result['effectiveResolutionValidFraction']=.9;self.assertFalse(supports_common_scale(result,320))

    def test_missing_quality_pixels_remain_missing_not_positive_observations(self):
        counts=np.ones((16,16));counts[8,8]=np.nan
        self.write('moonCounts',counts,MOON_PROJECTED,from_origin(-640,640,80,80))
        quality=native_quality(self.paths,[-320,-320,320,320])
        self.assertEqual(quality['validCountFraction'],63/64)
        self.assertFalse(supports_common_scale(quality,320))

    def test_quality_window_outside_grid_or_negative_counts_is_rejected(self):
        with self.assertRaisesRegex(ValueError,'outside'):native_quality(self.paths,[-1000,-320,320,320])
        counts=np.ones((16,16));counts[8,8]=-1
        self.write('moonCounts',counts,MOON_PROJECTED,from_origin(-640,640,80,80))
        with self.assertRaisesRegex(ValueError,'nonnegative'):native_quality(self.paths,[-320,-320,320,320])

    def test_lunar_window_preserves_body_and_metres_and_rejects_earth_source(self):
        center={'latitude':-89.99,'longitude':0}
        info=prepare_window(self.paths['moonElevation'],self.root/'prepared.tif','moon',center,80,5,Resampling.average)
        self.assertEqual(info['validFraction'],1)
        with rasterio.open(self.root/'prepared.tif') as ds:
            self.assertEqual(ds.res,(80,80));self.assertTrue(is_lunar_polar(ds.crs))
        with self.assertRaisesRegex(ValueError,'Earth or unrelated'):
            prepare_window(self.paths['earthSouth'],self.root/'invalid.tif','moon',center,80,5,Resampling.average)
        with self.assertRaisesRegex(ValueError,'horizontal metres'):
            prepare_window(self.paths['earthSouth'],self.root/'degrees.tif','earth',{'latitude':64.5,'longitude':-16.5},80,5,Resampling.average,earth_crs='EPSG:4326')

if __name__=='__main__':unittest.main()
