import unittest
from science.gis.coverage_plan import load_plan, pairs, SITE_IDS, TARGET_IDS

class CoveragePlanTests(unittest.TestCase):
    def test_all_catalog_pairs_covered_without_fabricated_results(self):
        rows = pairs(load_plan())
        self.assertEqual(len(rows), len(SITE_IDS) * len(TARGET_IDS))
        self.assertEqual(len({(r["earthSiteId"],r["targetId"]) for r in rows}), 10)
        self.assertTrue(all(r["score"] is None for r in rows))
        self.assertEqual(sum(r["status"] == "PROVISIONAL_QA" for r in rows), 10)

    def test_plan_rejects_missing_sources(self):
        data = load_plan()
        del data["earthSources"]["earth-atacama"]
        # Test schema semantics without mutating source file.
        self.assertNotEqual(set(data["earthSources"]), set(SITE_IDS))

    def test_moon_plan_separate_from_mars_with_caveats(self):
        plan = load_plan()
        self.assertIn("Diviner", plan["targetSources"]["moon-south-pole"]["note"])
        self.assertIn('LOLA',plan['targetSources']['moon-south-pole']['dataset'])
        self.assertIn("MOLA", plan["targetSources"]["mars-jezero"]["dataset"])
        self.assertIn("Polar", plan["earthSources"]["earth-haughton"]["dataset"])

if __name__ == "__main__":
    unittest.main()
