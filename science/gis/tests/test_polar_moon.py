import io
import tarfile
import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

from science.gis.polar_moon import extract_product, polar_quality, JOBS


class PolarInputTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory()
        self.root=Path(self.temporary.name)
        self.job=JOBS[0]

    def tearDown(self):
        self.temporary.cleanup()

    def archive(self, misaligned=False, version='4.1', link=False):
        product=self.job['product']
        with tarfile.open(self.root/(product+'.tar.gz'),'w:gz') as archive:
            for suffix in ('dem','count','mad'):
                path=self.root/(product+'_'+suffix+'.tif')
                with rasterio.open(path,'w',driver='GTiff',width=16,height=16,count=1,dtype='float32',
                                   crs='EPSG:3413',transform=from_origin(32 if misaligned and suffix=='mad' else 0,512,32,32),nodata=-9999) as output:
                    output.write(np.ones((16,16),dtype='float32'),1)
                if link and suffix=='dem':
                    member=tarfile.TarInfo(path.name);member.type=tarfile.SYMTYPE;member.linkname='../outside.tif';archive.addfile(member)
                else:archive.add(path,arcname=path.name)
            metadata=('ArcticDEM Mosaic Tile Metadata\nVersion: '+version).encode()
            member=tarfile.TarInfo(product+'_meta.txt');member.size=len(metadata);archive.addfile(member,io.BytesIO(metadata))
            member=tarfile.TarInfo('../outside.txt');member.size=3;archive.addfile(member,io.BytesIO(b'bad'))

    def test_extract_only_named_files_and_record_archive_identity(self):
        self.archive()
        paths,record=extract_product(self.root,self.root/'safe',self.job)
        self.assertEqual(len(paths),3)
        self.assertFalse((self.root/'outside.txt').exists())
        self.assertEqual(record['versionFromMetadata'],'4.1')
        self.assertFalse(record['independentlyVerified'])
        quality=polar_quality(paths,(0,0,512,512))
        self.assertEqual(quality['earthCount']['validFraction'],1)
        self.assertEqual(quality['earthMad']['median'],1)
        with self.assertRaisesRegex(ValueError,'outside'):
            polar_quality(paths,(-32,0,512,512))

    def test_misaligned_auxiliary_is_rejected(self):
        self.archive(misaligned=True)
        with self.assertRaisesRegex(ValueError,'misaligned'):extract_product(self.root,self.root/'safe',self.job)

    def test_incorrect_metadata_version_is_rejected(self):
        self.archive(version='9.9')
        with self.assertRaisesRegex(ValueError,'metadata'):extract_product(self.root,self.root/'safe',self.job)

    def test_symbolic_link_is_rejected(self):
        self.archive(link=True)
        with self.assertRaisesRegex(ValueError,'regular'):extract_product(self.root,self.root/'safe',self.job)


if __name__=='__main__':unittest.main()
