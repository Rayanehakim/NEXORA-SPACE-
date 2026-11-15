import json
import tempfile
import unittest
from pathlib import Path
from science.gis.export_experimental import ROOT, generate, canonical_hash


class ExperimentalExportTests(unittest.TestCase):
    def test_bundle_exactly_reproduces_all_profiles_from_tracked_baselines(self):
        expected=generate()
        actual=json.loads((ROOT/'frontend/src/data/experimentalComparisons.json').read_text(encoding='utf-8'))
        self.assertEqual(actual,expected)
        self.assertEqual(len(actual['comparisons']),20)
        self.assertEqual(actual['reviewStatus'],'UNREVIEWED')
        self.assertFalse(actual['scientificallyApproved'])

    def test_input_hashes_are_independent_of_windows_line_endings_and_json_spacing(self):
        with tempfile.TemporaryDirectory() as directory:
            first=Path(directory)/'first.json';second=Path(directory)/'second.json'
            first.write_bytes(b'{"b":2,\n"a":1}\n')
            second.write_bytes(b'{\r\n  "a": 1,\r\n  "b": 2\r\n}\r\n')
            self.assertEqual(canonical_hash(first),canonical_hash(second))


if __name__=='__main__':unittest.main()
