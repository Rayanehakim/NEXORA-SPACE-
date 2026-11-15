import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import rasterio
from rasterio.transform import from_origin

from science.gis.evidence_checks import read_counts_window, analyze_counts

class EvidenceChecksTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.image=self.root/'megc44n000hb.img'
        self.label=self.root/'megc44n000hb.lbl'
        # Mock the spatial chunk without allocating the 64 MB native file.
        self.label.write_text('''TARGET_NAME = MARS\nPRODUCT_ID = "MEGC44N000HB.IMG"\nOBJECT = IMAGE\n NAME = OBSERVATION_COUNTS\n LINES = 5632\n LINE_SAMPLES = 11520\n SAMPLE_BITS = 8\n SAMPLE_TYPE = MSB_UNSIGNED_INTEGER\nEND_OBJECT = IMAGE\nMAXIMUM_LATITUDE = 44.0\nMINIMUM_LATITUDE = 0.0\nWESTERNMOST_LONGITUDE = 0.0\nEASTERNMOST_LONGITUDE = 90.0\nMAP_RESOLUTION = 128.0\nEND\n''')
    def test_wrong_filename_rejected(self):
        self.image.write_bytes(b'123')
        with self.assertRaisesRegex(ValueError,'size'):
            read_counts_window(self.image,self.label,77.5,77.6,18.3,18.4)
    def test_valid_native_count_window(self):
        # Sparse 65 MB file, no large in-memory allocation.
        with open(self.image, 'wb') as fh:
            fh.truncate(5632 * 11520)
        row = int((44 - 18.38) * 128)
        col = int(77.58 * 128)
        with open(self.image, 'r+b') as fh:
            fh.seek(row * 11520 + col)
            fh.write(bytes([3]))
        counts, (first_row, first_col), meta = read_counts_window(
            self.image, self.label, 77.57, 77.59, 18.37, 18.39)
        self.assertEqual(int(counts[row-first_row, col-first_col]), 3)
        self.assertEqual(meta['sourceSampleBits'], 8)

    def test_nonmars_rejected(self):
        self.image.write_bytes(b'123')
        self.label.write_text(self.label.read_text().replace('TARGET_NAME = MARS','TARGET_NAME = EARTH'))
        with self.assertRaisesRegex(ValueError,'not for Mars'):
            read_counts_window(self.image,self.label,77.5,77.6,18.3,18.4)
    def test_not_silently_guess_packing(self):
        self.image.write_bytes(b'123')
        self.label.write_text(self.label.read_text().replace('SAMPLE_BITS = 8','SAMPLE_BITS = 32'))
        with self.assertRaisesRegex(ValueError,'packing'):
            read_counts_window(self.image,self.label,77.5,77.6,18.3,18.4)

if __name__=='__main__':unittest.main()
