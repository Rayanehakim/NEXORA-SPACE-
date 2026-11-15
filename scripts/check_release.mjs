/** Reject unreviewed public comparison/DEM artifacts; prototype builds need no scores. */
import {readFileSync,readdirSync,existsSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const repositoryRoot=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../frontend/package.json',import.meta.url));

function within(root,path){
  const absolute=resolve(root,path),rel=relative(root,absolute);
  if(!rel || rel==='..' || rel.startsWith('..'+(process.platform==='win32'?'\\':'/')) || isAbsolute(rel)) throw Error('Evidence path must stay within the repository');
  const real=realpathSync(absolute),realRel=relative(realpathSync(root),real);
  if(realRel==='..'||realRel.startsWith('..'+(process.platform==='win32'?'\\':'/'))||isAbsolute(realRel)) throw Error('Evidence symlink leaves the repository');
  return real;
}
function json(path){return JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));}
function hash(path){return createHash('sha256').update(readFileSync(path)).digest('hex');}
function verifiedInput(root,record){
  if(!record||typeof record.path!=='string'||!record.path.startsWith('data/evidence/')||!/^[a-f0-9]{64}$/.test(record.sha256??'')) throw Error('Reviewed input requires a tracked data/evidence path and SHA256');
  const path=within(root,record.path);
  if(hash(path)!==record.sha256) throw Error(`Input hash differs from its review: ${record.path}`);
  return json(path);
}

export async function checkRelease(root=repositoryRoot){
  const ledger=json(join(root,'data/evidence/releases.json'));
  if(ledger.version!=='nexora-reviewed-evidence-v1'||!Array.isArray(ledger.releases)) throw Error('Invalid release ledger');
  const actual=[];
  for(const kind of ['comparisons','terrain']){
    const folder=join(root,'frontend/public',kind);
    if(existsSync(folder)) for(const name of readdirSync(folder)){if(name.endsWith('.json')) actual.push(`${kind}/${name}`);}
  }
  const approvals=new Map();
  for(const entry of ledger.releases){
    if(!entry||typeof entry.file!=='string'||approvals.has(entry.file)||!actual.includes(entry.file)) throw Error('Duplicate or missing reviewed public artifact');
    approvals.set(entry.file,entry);
  }
  if(actual.some(file=>!approvals.has(file))) throw Error('Public comparison/terrain artifact has no scientific review approval');
  if(!actual.length) return {artifacts:0,mode:'PROTOTYPE_NO_PUBLISHED_SCORES'};

  const ts=require('typescript');
  const source=readFileSync(join(repositoryRoot,'frontend/src/features/analysis/comparisonValidation.ts'),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const {parseComparison}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  const terrainSource=readFileSync(join(repositoryRoot,'frontend/src/features/echo/terrain.ts'),'utf8');
  const terrainJs=ts.transpileModule(terrainSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const {validateTerrain}=await import(`data:text/javascript;base64,${Buffer.from(terrainJs).toString('base64')}`);
  const model=json(join(root,'science/scoring/model-v1.json'));
  for(const file of actual){
    const entry=approvals.get(file),review=entry.review;
    if(!review||typeof review.approvedBy!=='string'||!review.approvedBy.trim()||!Number.isFinite(Date.parse(review.approvedAt))||
       !['sourceLabelsVerified','measurementsReproduced','limitationsReviewed'].every(flag=>review[flag]===true)) throw Error(`Incomplete scientific review: ${file}`);
    const path=within(join(root,'frontend/public'),file);
    if(hash(path)!==entry.sha256) throw Error(`Public artifact hash differs from its review: ${file}`);
    const earth=verifiedInput(root,entry.inputs?.earth),target=verifiedInput(root,entry.inputs?.target),plan=verifiedInput(root,entry.inputs?.plan);
    if(earth.body!=='earth'||!['mars','moon'].includes(target.body)||
       ![earth,target].every(data=>data.dataStatus==='READY'&&data.validFraction===1&&Array.isArray(data.provenance)&&data.provenance.length&&data.provenance.every(source=>source.evidenceType==='MEASURED'))||
       plan.version!=='analysis-plan-v1') throw Error(`Reviewed measured input pair required: ${file}`);
    const result=json(path);
    if(file.startsWith('comparisons/')){
      if(!parseComparison(result,target.regionId,earth.regionId,result.missionProfile)||result.status!=='READY'||result.modelVersion!==model.modelVersion||
         file!==`comparisons/${earth.regionId}--${target.regionId}--${result.missionProfile}.json`) throw Error(`Invalid reviewed comparison: ${file}`);
      const sourceIds=[...new Set([...earth.provenance,...target.provenance].map(source=>source.sourceId))].sort();
      if(JSON.stringify([...result.sourceIds].sort())!==JSON.stringify(sourceIds)||result.gaps.some(gap=>gap.evidenceType==='SIMULATED')||result.evidenceGaps.some(note=>/SIMULATED inputs/.test(note))) throw Error(`Published comparison must preserve reviewed measured provenance: ${file}`);
      for(const row of result.featureContributions){
        if(row.earthValue!==earth[row.feature]||row.targetValue!==target[row.feature]||row.weight!==model.profiles[result.missionProfile]?.[row.feature]||row.tolerance!==model.features[row.feature]?.tolerance) throw Error(`Comparison does not match reviewed inputs/model: ${file}`);
      }
    }else{
      validateTerrain(result,earth.regionId);
      if(result.earthSiteId!==earth.regionId||result.sourceType!=='DEM_DERIVED'||file!==`terrain/${earth.regionId}.json`||
         !earth.provenance.some(source=>source.sourceId===result.provenanceSourceId)) throw Error(`Invalid reviewed terrain identity: ${file}`);
    }
  }
  return {artifacts:actual.length,mode:'REVIEWED_MEASURED_ARTIFACTS'};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log('Release evidence check:',await checkRelease());}
  catch(error){console.error('Release blocked:',error.message);process.exitCode=1;}
}
