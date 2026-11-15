import unittest
from science.scoring.cli import compare
class ScoringTests(unittest.TestCase):
    def pair(self):
        a=dict(regionId='synthetic-earth',body='earth',algorithmVersion='synthetic-v1',scaleM=30,dataStatus='READY',validFraction=1,provenance=[dict(sourceId='synthetic-test')],meanSlopeDeg=2,p90SlopeDeg=4,roughnessM=5,reliefM=20)
        return a,dict(a,regionId='synthetic-mars',body='mars')
    def test_identity(self):
        self.assertEqual(compare(*self.pair())['score'],100)
    def test_monotonic(self):
        a,b=self.pair(); b['meanSlopeDeg']=5
        first=compare(a,b)['score']; b['meanSlopeDeg']=8
        self.assertLess(compare(a,b)['score'],first)
    def test_missing(self):
        a,b=self.pair(); a['roughnessM']=None
        self.assertIsNone(compare(a,b)['score'])
    def test_scale(self):
        a,b=self.pair(); b['scaleM']=60
        self.assertEqual(compare(a,b)['status'],'INCOMPLETE_DATA')
if __name__=='__main__': unittest.main()
