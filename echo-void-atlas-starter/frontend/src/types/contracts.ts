/** Contract v1.0.0 — A is sole owner. All component APIs are declared here. */
export type Planet = 'mars' | 'moon';
export type DataStatus = 'READY' | 'INCOMPLETE_DATA';
export type EvidenceType = 'MEASURED' | 'LITERATURE' | 'SIMULATED' | 'UNKNOWN';
export type MissionProfile = 'terrain_mobility' | 'geological_survey';
export type GapCategory = 'PHYSICAL' | 'PLANETARY' | 'EVIDENCE' | 'OPERATIONAL';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

export interface DatasetProvenance {
  sourceId: string;
  name: string;
  url: string | null;
  version: string | null;
  nativeResolutionM: number | null;
  processingMethod: string;
  evidenceType: EvidenceType;
}
export interface RegionBounds { west: number; south: number; east: number; north: number }
export interface PlanetaryTarget {
  id: string;
  body: Planet;
  name: string;
  regionName: string;
  bounds: RegionBounds | null;
  datasetId: string | null;
  featureSetId: string | null;
  resolutionM: number | null;
  dataStatus: DataStatus;
}
export interface EarthSite {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  bounds: RegionBounds | null;
  environmentType: string;
  selectionRationale: string;
  datasetIds: string[];
  dataStatus: DataStatus;
  terrainAssetUrl: string | null;
}
export interface FeatureSet {
  regionId: string;
  body: Planet | 'earth';
  algorithmVersion: string;
  /** Effective common analysis scale in metres, NOT automatically native source resolution. */
  scaleM: number;
  meanSlopeDeg: number | null;
  p90SlopeDeg: number | null;
  /** Residual elevation standard deviation (metres) within a documented fixed window. */
  roughnessM: number | null;
  /** Max–min elevation (metres) across a documented fixed physical footprint. */
  reliefM: number | null;
  validFraction: number;
  provenance: DatasetProvenance[];
  dataStatus: DataStatus;
}
export interface FeatureContribution {
  feature: 'meanSlopeDeg' | 'p90SlopeDeg' | 'roughnessM' | 'reliefM';
  earthValue: number | null;
  targetValue: number | null;
  unit: 'deg' | 'm';
  weight: number;
  tolerance: number;
  distance: number | null;
  contribution: number | null;
}
export interface AnalogGap {
  category: GapCategory;
  severity: Severity;
  claim: string;
  experimentImplication: string;
  evidenceType: EvidenceType;
  sourceUrl: string | null;
}
export interface ComparisonResult {
  targetId: string;
  earthSiteId: string;
  missionProfile: MissionProfile;
  modelVersion: string;
  status: DataStatus;
  /** Model index 0–100 or null; NOT planetary equivalence or mission success probability. */
  score: number | null;
  featureContributions: FeatureContribution[];
  gaps: AnalogGap[];
  evidenceGaps: string[];
  sourceIds: string[];
}
export interface TerrainAsset {
  earthSiteId: string;
  version: string;
  sourceType: 'DEM_DERIVED' | 'PROCEDURAL';
  /** Number of columns, x coordinate; grid samples are elevationM[row][column]. */
  width: number;
  /** Number of rows, z coordinate. */
  height: number;
  cellSizeM: number;
  /** Local x and z horizontally, y as vertical height, all in metres. */
  elevationM: number[][];
  provenanceSourceId: string | null;
}
export interface DroneObservation { sequence: number; xM: number; zM: number; kind: string }
export interface SimulationReport {
  earthSiteId: string;
  terrainAssetVersion: string;
  missionId: string;
  scannedFraction: number;
  distanceTravelledM: number;
  observations: DroneObservation[];
  simulated: true;
}
export interface ExplorerProps {
  sites: EarthSite[];
  selectedSiteId: string | null;
  selectedPlanet: Planet;
  onSelectSite: (siteId: string) => void;
}
export interface AnalysisProps {
  target: PlanetaryTarget | null;
  site: EarthSite | null;
  comparison: ComparisonResult | null;
}
export interface EchoProps {
  site: EarthSite;
  terrain: TerrainAsset;
  onMissionComplete: (report: SimulationReport) => void;
}
export interface ReportProps extends AnalysisProps { simulation: SimulationReport | null }
