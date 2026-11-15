import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const snapshot=JSON.parse(readFileSync('src/data/importedTerrainEvidence.json','utf8'));

test('polar trial snapshots retain independent Earth sources and matched lunar windows without scores',()=>{
 for(const [site,crs,version] of [['earth-haughton','EPSG:3413','4.1'],['earth-mcmurdo','EPSG:3031','2.0']]){
  const evidence=JSON.parse(readFileSync(`src/data/${site}-moon-evidence.json`,'utf8'));
  assert.equal(evidence.selection.earthSiteId,site);assert.equal(evidence.selection.targetId,'moon-south-pole');
  assert.equal(evidence.study.earthCrs,crs);assert.equal(evidence.footprintWidthM,5120);
  assert.equal(evidence.archive.versionFromMetadata,version);assert.equal(evidence.archive.independentlyVerified,false);
  assert.equal(evidence.sources.length,6);assert.equal(new Set(evidence.sources.map(s=>s.role)).size,6);
  assert.equal(evidence.earthValidFraction,1);assert.equal(evidence.moonValidFraction,1);assert.equal(evidence.allScenariosSupported,true);
  assert.equal(evidence.scorePublicationApproved,false);assert.equal('score' in evidence,false);
  assert.ok(evidence.earthAttribution.includes('CC BY 4.0'));
  assert.ok(evidence.limitations.some(note=>note.includes('unequal footprints')));
  for(const source of evidence.sources)assert.match(source.sha256,/^[a-f0-9]{64}$/);
 }
});
test('five imported files retain distinct roles, checksums, unverified releases and no published score',()=>{
 assert.equal(snapshot.sources.length,5);assert.equal(new Set(snapshot.sources.map(source=>source.role)).size,5);
 assert.equal(snapshot.status,'PROVISIONAL_QA');assert.equal(snapshot.scorePublicationApproved,false);assert.equal('score' in snapshot,false);
 for(const source of snapshot.sources){assert.match(source.sha256,/^[a-f0-9]{64}$/);assert.equal(source.releaseVersionVerified,false);assert.ok(source.sourceUrl.startsWith('https://'))}
 assert.equal(snapshot.selection.earthSiteId,'earth-askja');assert.equal(snapshot.selection.targetId,'moon-south-pole');
});
test('quality distinguishes native-bin support from raster completeness and contains valid sensitivity ranges',()=>{
 const quality=snapshot.lunarQuality;
 assert.equal(quality.positiveCountFraction,quality.positiveCountBins/quality.nativeBinCount);
 assert.ok(quality.effectiveResolutionM.max<=snapshot.study.cellSizeM);assert.equal(snapshot.allScenariosSupported,true);
 assert.equal(snapshot.footprintWidthM,snapshot.study.cellSizeM*snapshot.study.pixels);
 for(const metric of snapshot.metrics)for(const body of ['earth','moon']){assert.ok(metric[body+'Range'][0]<=metric[body+'Baseline']);assert.ok(metric[body+'Baseline']<=metric[body+'Range'][1])}
 assert.ok(snapshot.limitations.some(note=>note.includes('fractional')));assert.ok(snapshot.limitations.some(note=>note.includes('surface model')));
});
