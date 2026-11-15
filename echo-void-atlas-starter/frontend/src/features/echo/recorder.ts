import type { DroneObservation, SimulationReport } from '../../types/contracts';

export interface ScanEvent { scanId: number; positionM: { x: number; z: number } }
export interface SurveySummary { status: string; coverageFraction: number; distanceM: number }

/** Mutable event collection preserves scans even when completion fires in the same frame. */
export function createRecorder(siteId: string, version: string) {
  let observations: DroneObservation[] = [];
  return {
    reset() { observations = []; },
    scan(event: ScanEvent) {
      if (!Number.isInteger(event?.scanId) || event.scanId < 1 || !Number.isFinite(event.positionM?.x) || !Number.isFinite(event.positionM?.z)) return;
      if (observations.some(observation => observation.sequence === event.scanId)) return;
      observations.push({ sequence: event.scanId, xM: event.positionM.x, zM: event.positionM.z, kind: 'SIMULATED_SCAN' });
    },
    get count() { return observations.length; },
    complete(summary: SurveySummary): SimulationReport | null {
      if (summary.status !== 'COMPLETE' || !Number.isFinite(summary.coverageFraction) || summary.coverageFraction < 0 || summary.coverageFraction > 1 || !Number.isFinite(summary.distanceM) || summary.distanceM < 0) return null;
      return { earthSiteId: siteId, terrainAssetVersion: version, missionId: crypto.randomUUID(), scannedFraction: summary.coverageFraction,
        distanceTravelledM: summary.distanceM, observations: observations.map(observation => ({ ...observation })), simulated: true };
    }
  };
}
