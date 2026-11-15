import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from jsonschema import Draft202012Validator
from science.scoring.engine import CONFIG, compare
from science.scoring.demo import synthetic_pair
from science.scoring.validation import ROOT, validate_config

class ScoringTests(unittest.TestCase):
    def setUp(self):
        self.earth, self.target, self.plan = synthetic_pair()

    def score(self, profile='terrain_mobility'):
        return compare(self.earth, self.target, profile, self.plan)

    def incomplete(self, result):
        self.assertEqual(result['status'], 'INCOMPLETE_DATA')
        self.assertIsNone(result['score'])
        self.assertTrue(all(row['distance'] is None for row in result['featureContributions']))

    def test_identical_synthetic_features_score_100_with_disclosure(self):
        result = self.score()
        self.assertEqual(result['score'], 100)
        self.assertTrue(any('SIMULATED' in warning for warning in result['evidenceGaps']))

    def test_exact_formula_and_explainable_contributions(self):
        self.target['meanSlopeDeg'] = 7  # distance .5, weight .35, loss .175
        result = self.score()
        self.assertAlmostEqual(result['score'], 82.5)
        self.assertAlmostEqual(result['featureContributions'][0]['contribution'], .175)
        self.assertAlmostEqual(self.score('geological_survey')['score'], 92.5)

    def test_monotonic_differences_and_saturation_for_every_feature_and_profile(self):
        for profile in CONFIG['profiles']:
            for feature, spec in CONFIG['features'].items():
                scores = []
                for distance in (0, .25, .5, 1, 2):
                    self.target = copy.deepcopy(self.earth)
                    self.target.update(body='mars', regionId='synthetic-mars')
                    self.target[feature] += spec['tolerance'] * distance
                    scores.append(self.score(profile)['score'])
                self.assertEqual(scores, sorted(scores, reverse=True))
                self.assertEqual(scores[-1], scores[-2])

    def test_zero_values_are_valid(self):
        for feature in CONFIG['features']:
            self.earth[feature] = self.target[feature] = 0
        self.assertEqual(self.score()['score'], 100)

    def test_all_features_at_tolerance_score_zero(self):
        for feature, spec in CONFIG['features'].items():
            self.target[feature] = self.earth[feature] + spec['tolerance']
        self.assertEqual(self.score()['score'], 0)

    def test_missing_features_invalid_numbers_and_slope_ranges(self):
        for feature in CONFIG['features']:
            for value in (None, True, -1, float('nan'), float('inf'), '5', 10**1000):
                with self.subTest(feature=feature, value=value):
                    self.earth, self.target, self.plan = synthetic_pair()
                    self.target[feature] = value
                    self.incomplete(self.score())
        self.target = synthetic_pair()[1]
        self.target['meanSlopeDeg'] = 91
        self.incomplete(self.score())

    def test_missing_plan_scale_algorithm_coverage_and_pending_status(self):
        self.incomplete(compare(self.earth, self.target))
        for patch in ({'scaleM': 60}, {'algorithmVersion': 'other'}, {'validFraction': .99}, {'dataStatus': 'INCOMPLETE_DATA'}, {'provenance': []}):
            self.target = dict(synthetic_pair()[1], **patch)
            self.incomplete(self.score())

    def test_plan_requires_matched_footprints_methods_ids_and_body_correct_projection(self):
        for key, value in [('footprintWidthM', 2000), ('roughnessWindowM', 120), ('regionId', 'wrong'), ('body', 'earth'), ('crs', 'EPSG:32631')]:
            self.plan = synthetic_pair()[2]
            self.plan['regions'][1][key] = value
            self.incomplete(self.score())
        self.plan = synthetic_pair()[2]
        self.plan['definitionsVersion'] = 'unknown'
        self.incomplete(self.score())
        self.plan = synthetic_pair()[2]
        self.plan['regions'][0]['bounds']['east'] = -1
        self.incomplete(self.score())

    def test_provenance_must_be_complete_and_not_claim_finer_source_detail(self):
        for patch in ({'version': None}, {'nativeResolutionM': 60}, {'evidenceType': 'UNKNOWN'}, {'processingMethod': ''}):
            self.earth = synthetic_pair()[0]
            self.earth['provenance'][0].update(patch)
            self.incomplete(self.score())
        self.earth = synthetic_pair()[0]
        self.earth['provenance'][0].update(evidenceType='MEASURED', url='https://example.test/source')
        self.incomplete(self.score())  # mixing simulated and measured is forbidden
        self.target['provenance'][0].update(evidenceType='MEASURED', url=None)
        self.incomplete(self.score())

    def test_malformed_inputs_produce_schema_valid_incomplete_results(self):
        for malformed in (None, [], 4, 'invalid', {}, {'provenance': [None, 1, 'bad']}):
            with self.subTest(value=malformed):
                result = compare(malformed, self.target)
                self.incomplete(result)
                json.dumps(result, allow_nan=False)

    def test_unknown_profile_and_invalid_model_config_rejected(self):
        with self.assertRaises(ValueError): self.score('unsupported')
        for field, value in [('tolerance', 0), ('tolerance', float('nan')), ('unit', 'km')]:
            config = copy.deepcopy(CONFIG)
            config['features']['roughnessM'][field] = value
            with self.assertRaises(ValueError): validate_config(config)
        config = copy.deepcopy(CONFIG)
        config['profiles']['terrain_mobility']['meanSlopeDeg'] = .9
        with self.assertRaises(ValueError): validate_config(config)

    def test_metre_units_and_measured_source_links(self):
        self.plan['regions'][0]['crs'] = 'EPSG:4326'
        self.incomplete(self.score())
        self.plan = synthetic_pair()[2]
        self.plan['regions'][1]['crs'] = '+proj=eqc +R=3389500 +units=km'
        self.incomplete(self.score())
        self.plan = synthetic_pair()[2]
        # Stub metadata only tests the measured-validation branch, not real evidence.
        for data in (self.earth, self.target):
            data['provenance'][0].update(evidenceType='MEASURED', url='https://example.test/validation-stub')
        result = self.score()
        self.assertEqual(result['status'], 'READY')
        physical = next(gap for gap in result['gaps'] if gap['category'] == 'PHYSICAL')
        self.assertEqual(physical['sourceUrl'], 'https://example.test/validation-stub')

    def test_gap_categories_sources_and_schema_for_mars_and_moon(self):
        for body in ('mars', 'moon'):
            self.target['body'] = body
            self.plan['regions'][1]['body'] = body
            self.plan['regions'][1]['crs'] = '+proj=eqc +R=1737400 +units=m' if body == 'moon' else '+proj=eqc +R=3389500 +units=m'
            result = self.score()
            self.assertEqual({gap['category'] for gap in result['gaps']}, {'PHYSICAL','PLANETARY','EVIDENCE','OPERATIONAL'})
            planetary = next(gap for gap in result['gaps'] if gap['category'] == 'PLANETARY')
            self.assertEqual(planetary['sourceUrl'], f'https://science.nasa.gov/{body}/facts/')
            schema = json.loads((ROOT/'contracts/comparison-result.schema.json').read_text())
            Draft202012Validator(schema).validate(result)
            self.assertEqual(result, self.score())

    def test_cli_roundtrip_file_output_and_bad_json(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            for name, data in zip(('earth','target','plan'), (self.earth,self.target,self.plan)):
                (directory/f'{name}.json').write_text(json.dumps(data),encoding='utf-8')
            command = [sys.executable,'-m','science.scoring.cli',str(directory/'earth.json'),str(directory/'target.json'),'--plan',str(directory/'plan.json')]
            run = subprocess.run(command,cwd=ROOT,capture_output=True,text=True)
            self.assertEqual(run.returncode,0,run.stderr)
            self.assertEqual(json.loads(run.stdout)['score'],100)
            output = directory/'result.json'
            run = subprocess.run(command+['--output',str(output)],cwd=ROOT,capture_output=True,text=True)
            self.assertEqual(run.returncode,0,run.stderr)
            self.assertEqual(run.stdout,'')
            self.assertEqual(json.loads(output.read_text())['score'],100)
            (directory/'earth.json').write_text('{bad json',encoding='utf-8')
            run = subprocess.run(command,cwd=ROOT,capture_output=True,text=True)
            self.assertEqual(run.returncode,2)
            self.assertEqual(run.stdout,'')
            self.assertIn('Input/output error',run.stderr)

if __name__ == '__main__': unittest.main()
