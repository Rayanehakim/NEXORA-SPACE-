import type { EarthSite, PlanetaryTarget, FeatureSet, ComparisonResult, TerrainAsset } from '../../types/contracts';
/** Candidate coordinates are approximate points for orientation, not study boundaries. */
export const targets: PlanetaryTarget[] = [
  {id:'mars-jezero',body:'mars',name:'Jezero Crater',regionName:'Jezero reference window (to be bounded)',bounds:null,datasetId:'MEGT44N000HB.IMG',featureSetId:null,resolutionM:null,dataStatus:'INCOMPLETE_DATA'},
  {id:'moon-south-pole',body:'moon',name:'Lunar South Pole',regionName:'South polar reference window (provisional terrain trial)',bounds:null,datasetId:'LDEM_80S_80MPP_ADJ',featureSetId:null,resolutionM:null,dataStatus:'INCOMPLETE_DATA'},
];
export const sites: EarthSite[] = [
  {id:'earth-atacama',name:'Atacama Desert',country:'Chile',latitude:-24.5,longitude:-69.25,bounds:null,environmentType:'Arid desert',selectionRationale:'Known Mars-analog research context; evaluate a precisely bounded candidate patch; locally reproduced Mars/Moon trials available, independent review pending.',datasetIds:['s25w070.hgt'],dataStatus:'INCOMPLETE_DATA',terrainAssetUrl:null},
  {id:'earth-erfoud',name:'Erfoud region',country:'Morocco',latitude:31.43,longitude:-4.23,bounds:null,environmentType:'Rocky desert',selectionRationale:'Historical MARS2013 field-testing area; exact analysis footprint must be locally reproduced matched Mars/Moon terrain trials available; independent review pending.',datasetIds:['n31w005.hgt'],dataStatus:'INCOMPLETE_DATA',terrainAssetUrl:null},
  {id:'earth-askja',name:'Askja volcanic region',country:'Iceland',latitude:65.03,longitude:-16.75,bounds:null,environmentType:'Volcanic',selectionRationale:'Potential basaltic terrain analog; locally processed terrain trial available; geological and source-release review pending.',datasetIds:['COPERNICUS-ASKJA-N64-N65'],dataStatus:'INCOMPLETE_DATA',terrainAssetUrl:null},
  {id:'earth-haughton',name:'Haughton Crater',country:'Canada',latitude:75.38,longitude:-89.67,bounds:null,environmentType:'Impact crater',selectionRationale:'Impact geology and Arctic analog research precedent; locally processed ArcticDEM Mars/Moon trials available; independent review pending.',datasetIds:['29_29_32m_v4.1_dem.tif'],dataStatus:'INCOMPLETE_DATA',terrainAssetUrl:null},
  {id:'earth-mcmurdo',name:'McMurdo Dry Valleys',country:'Antarctica',latitude:-77.5,longitude:162.0,bounds:null,environmentType:'Polar desert',selectionRationale:'Cold, dry polar field analog; locally processed REMA Mars/Moon trials available; independent review pending.',datasetIds:['18_35_32m_v2.0_dem.tif'],dataStatus:'INCOMPLETE_DATA',terrainAssetUrl:null},
];
/** Explicit mock containing no fabricated measured NASA terrain values. */
export const pendingFeature: FeatureSet = {
  regionId:'earth-erfoud',body:'earth',algorithmVersion:'pending',scaleM:30,
  meanSlopeDeg:null,p90SlopeDeg:null,roughnessM:null,reliefM:null,
  validFraction:0,provenance:[],dataStatus:'INCOMPLETE_DATA',
};
export const pendingComparison: ComparisonResult = {
  targetId:'mars-jezero',earthSiteId:'earth-erfoud',missionProfile:'terrain_mobility',
  modelVersion:'pending',status:'INCOMPLETE_DATA',score:null,featureContributions:[],
  gaps:[
    {category:'PLANETARY',severity:'HIGH',claim:'Earth does not reproduce the Martian atmosphere or gravity.',experimentImplication:'Field navigation rehearsal is not a complete Mars rover validation.',evidenceType:'LITERATURE',sourceUrl:null},
    {category:'EVIDENCE',severity:'HIGH',claim:'Terrain features have not yet been processed for this exact comparison.',experimentImplication:'Do not infer a numeric analog score.',evidenceType:'UNKNOWN',sourceUrl:null}
  ],evidenceGaps:['Matching Earth and Mars terrain metrics pending'],sourceIds:[],
};
/** 8x8 procedural heightmap. Synthetic test geometry; not a real site. */
export const proceduralTerrain: TerrainAsset = {
  earthSiteId:'earth-erfoud',version:'procedural-demo-v1',sourceType:'PROCEDURAL',
  width:8,height:8,cellSizeM:25,provenanceSourceId:null,
  elevationM:Array.from({length:8},(_,z)=>Array.from({length:8},(_,x)=>
    Math.round(4*Math.sin(x/1.7)*Math.cos(z/2)+0.5*x))),
};
