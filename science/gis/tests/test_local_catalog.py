import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

import numpy as np
import rasterio

from science.gis.local_catalog import raw_vrt, validate_mola


class LocalCatalogInputTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory()
        self.root=Path(self.temporary.name)
        self.label_text=(Path(__file__).resolve().parents[3]/'data/evidence/local-catalog/megt44n000hb-label.txt').read_text()
        self.image=Mock()
        self.image.name='megt44n000hb.img'
        self.image.stat.return_value.st_size=5632*11520*2

    def tearDown(self):self.temporary.cleanup()

    def label(self,text):
        path=self.root/'label.txt';path.write_text(text);return path

    def test_label_checks_body_packing_units_geometry_and_file_size(self):
        record=validate_mola(self.image,self.label(self.label_text))
        self.assertEqual(record['reportedVersion'],'2.0')
        self.assertFalse(record['independentlyVerified'])
        for original,replacement in [('TARGET_NAME                   = MARS','TARGET_NAME = EARTH'),
                                     ('SAMPLE_BITS                  = 16','SAMPLE_BITS = 8'),
                                     ('UNIT                         = METER','UNIT = FOOT'),
                                     ('A_AXIS_RADIUS                = 3396.0','A_AXIS_RADIUS = 6378.0')]:
            self.assertIn(original,self.label_text)
            with self.assertRaises(ValueError):validate_mola(self.image,self.label(self.label_text.replace(original,replacement)))
        self.image.stat.return_value.st_size-=1
        with self.assertRaisesRegex(ValueError,'dimensions'):validate_mola(self.image,self.label(self.label_text))

    def test_raw_topography_vrt_preserves_signed_big_endian_values_and_lunar_incompatible_radius(self):
        raw=self.root/'input.bin'
        values=np.array([[1,-2],[256,-32768]],dtype='>i2');raw.write_bytes(values.tobytes())
        vrt=raw_vrt(self.root/'generated'/'test.vrt',raw,2,2,'Int16',(0,1/128,0,44,0,-1/128),'+proj=longlat +R=3396000 +no_defs',2)
        with rasterio.open(vrt) as source:
            np.testing.assert_array_equal(source.read(1),values)
            self.assertEqual(source.crs.to_dict().get('R'),3396000)
            self.assertEqual(source.nodata,None)
        self.assertIn('relativeToVRT="1"',vrt.read_text())
        self.assertTrue((vrt.parent/'input.bin').is_file())


if __name__=='__main__':unittest.main()
