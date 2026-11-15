import type { TerrainAsset } from '../../types/contracts';

export function createDemoTerrain(siteId: string): TerrainAsset {
  return { earthSiteId: siteId, version: 'procedural-demo-v2', sourceType: 'PROCEDURAL', width: 49, height: 49,
    cellSizeM: 20, provenanceSourceId: null,
    elevationM: Array.from({ length: 49 }, (_, z) => Array.from({ length: 49 }, (_, x) =>
      Math.round(12 * Math.sin(x / 7) * Math.cos(z / 9) + 7 * Math.exp(-((x - 33) ** 2 + (z - 20) ** 2) / 90)))) };
}

export function validateTerrain(input: unknown, siteId: string): TerrainAsset {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Terrain must be a JSON object.');
  const terrain = input as TerrainAsset;
  if (terrain.earthSiteId !== siteId) throw Error('Terrain belongs to a different Earth candidate.');
  if (typeof terrain.version !== 'string' || !terrain.version.trim()) throw Error('Terrain version is required.');
  if (!['PROCEDURAL', 'DEM_DERIVED'].includes(terrain.sourceType)) throw Error('Unknown terrain source type.');
  if (!Number.isInteger(terrain.width) || !Number.isInteger(terrain.height) || terrain.width < 2 || terrain.height < 2 || terrain.width > 256 || terrain.height > 256) throw Error('Terrain dimensions must be between 2 and 256.');
  if (!Number.isFinite(terrain.cellSizeM) || terrain.cellSizeM <= 0) throw Error('Terrain spacing must be positive metres.');
  if (!Array.isArray(terrain.elevationM) || terrain.elevationM.length !== terrain.height || !terrain.elevationM.every(row => Array.isArray(row) && row.length === terrain.width && row.every(value => typeof value === 'number' && Number.isFinite(value)))) throw Error('Terrain must contain a complete finite elevation grid.');
  if (terrain.sourceType === 'DEM_DERIVED' && (typeof terrain.provenanceSourceId !== 'string' || !terrain.provenanceSourceId.trim())) throw Error('DEM-derived terrain requires a provenance source ID.');
  if (terrain.provenanceSourceId !== null && typeof terrain.provenanceSourceId !== 'string') throw Error('Invalid terrain provenance source ID.');
  return terrain;
}

export function toDroneTerrain(input: TerrainAsset, siteId: string) {
  const terrain = validateTerrain(input, siteId);
  return { schema: 'echo-void-dem-v1', body: 'earth', name: `${terrain.sourceType} / ${terrain.version}`,
    width: terrain.width, height: terrain.height, pixel_size_x_m: terrain.cellSizeM, pixel_size_y_m: terrain.cellSizeM,
    elevations_m: terrain.elevationM,
    provenance: { source_url: terrain.sourceType === 'PROCEDURAL' ? `simulated:${terrain.version}` : `source-id:${terrain.provenanceSourceId}`,
      evidence_type: terrain.sourceType === 'PROCEDURAL' ? 'SIMULATED' : 'MEASURED' } };
}
