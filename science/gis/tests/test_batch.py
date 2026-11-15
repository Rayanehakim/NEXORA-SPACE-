import tempfile
import unittest
from pathlib import Path
from science.gis.batch import run_batch, validate_entry

class BatchTests(unittest.TestCase):
    def test_missing_manifest_stays_unprocessed(self):
        with tempfile.TemporaryDirectory() as d:
            output=run_batch({"jobs":[{"earthSiteId":"earth-atacama","targetId":"moon-south-pole",
              "manifest":str(Path(d)/"missing.json")}]},Path(d))
            self.assertEqual(output["results"][0]["status"],"NOT_PROCESSED")
            self.assertFalse(output["results"][0]["scorePublished"])

    def test_reject_duplicates(self):
        entry={"earthSiteId":"earth-atacama","targetId":"mars-jezero","manifest":"/missing"}
        with self.assertRaises(ValueError):
            run_batch({"jobs":[entry,entry]}, Path("/tmp"))

    def test_reject_unknown_pair(self):
        with self.assertRaises(ValueError):
            validate_entry({"earthSiteId":"earth-invented","targetId":"mars-jezero","manifest":"/missing"})
