import type { EarthSite, PlanetaryTarget, Planet, MissionProfile, SimulationReport } from '../types/contracts';

export interface MissionSelection {
  planet: Planet;
  targetId: string;
  earthSiteId: string | null;
  missionProfile: MissionProfile;
  simulationReport: SimulationReport | null;
}
export type MissionAction =
  | { type: 'planet'; value: Planet }
  | { type: 'target'; value: string }
  | { type: 'site'; value: string }
  | { type: 'profile'; value: MissionProfile }
  | { type: 'simulation'; value: SimulationReport | null };

export function initialMission(sites: EarthSite[], targets: PlanetaryTarget[]): MissionSelection {
  const target = targets.find(t => t.body === 'mars') ?? targets[0];
  return { planet: target?.body ?? 'mars', targetId: target?.id ?? '', earthSiteId: sites[0]?.id ?? null,
    missionProfile: 'terrain_mobility', simulationReport: null };
}

export function updateMission(state: MissionSelection, action: MissionAction, sites: EarthSite[], targets: PlanetaryTarget[]): MissionSelection {
  switch (action.type) {
    case 'planet': {
      if (!['mars', 'moon'].includes(action.value) || action.value === state.planet) return state;
      return { ...state, planet: action.value, targetId: targets.find(t => t.body === action.value)?.id ?? '', simulationReport: null };
    }
    case 'target':
      return targets.some(t => t.id === action.value && t.body === state.planet) && action.value !== state.targetId
        ? { ...state, targetId: action.value, simulationReport: null } : state;
    case 'site':
      return sites.some(s => s.id === action.value) && action.value !== state.earthSiteId
        ? { ...state, earthSiteId: action.value, simulationReport: null } : state;
    case 'profile':
      return ['terrain_mobility', 'geological_survey'].includes(action.value) && action.value !== state.missionProfile
        ? { ...state, missionProfile: action.value, simulationReport: null } : state;
    case 'simulation': {
      const report = action.value;
      if (report === null) return { ...state, simulationReport: null };
      if (report.earthSiteId !== state.earthSiteId || report.simulated !== true ||
          !Number.isFinite(report.scannedFraction) || report.scannedFraction < 0 || report.scannedFraction > 1 ||
          !Number.isFinite(report.distanceTravelledM) || report.distanceTravelledM < 0) return state;
      return { ...state, simulationReport: report };
    }
  }
}
