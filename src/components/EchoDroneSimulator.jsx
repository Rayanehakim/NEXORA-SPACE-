import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// TESTABLE_CORE_START
function validateDem(input) {
  const d = typeof input === 'string' ? JSON.parse(input) : input;
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw Error('DEM must be a JSON object');
  if (d.schema !== 'echo-void-dem-v1') throw Error('Unsupported DEM schema');
  if (!['earth', 'mars', 'moon'].includes(d.body)) throw Error('DEM body must be earth, mars, or moon');
  if (!Number.isInteger(d.width) || !Number.isInteger(d.height) || d.width < 2 || d.height < 2 || d.width > 256 || d.height > 256) throw Error('DEM dimensions must be integers between 2 and 256');
  if (!Number.isFinite(d.pixel_size_x_m) || d.pixel_size_x_m <= 0 || !Number.isFinite(d.pixel_size_y_m) || d.pixel_size_y_m <= 0) throw Error('DEM pixel sizes must be finite positive metres');
  if (!Array.isArray(d.elevations_m) || d.elevations_m.length !== d.height || !d.elevations_m.every(row => Array.isArray(row) && row.length === d.width && row.every(n => n === null || (typeof n === 'number' && Number.isFinite(n))))) throw Error('DEM elevations_m must be a rectangular grid of finite numbers or null');
  if (typeof d.provenance?.source_url !== 'string' || !d.provenance.source_url.trim()) throw Error('DEM provenance.source_url is required');
  return d;
}
function demoDem() {
  const width = 49, height = 49;
  return {
    schema: 'echo-void-dem-v1', body: 'earth', name: 'Procedural demonstration', width, height,
    pixel_size_x_m: 20, pixel_size_y_m: 20,
    elevations_m: Array.from({ length: height }, (_, j) => Array.from({ length: width }, (_, i) =>
      Math.round(12 * Math.sin(i / 7) * Math.cos(j / 9) + 7 * Math.exp(-((i - 33) ** 2 + (j - 20) ** 2) / 90)))),
    provenance: { source_url: 'simulated:local-procedural-terrain' },
  };
}
function resolveTerrain(input) {
  if (input == null) return { dem: demoDem(), simulated: true, error: null };
  try { return { dem: validateDem(input), simulated: false, error: null }; }
  catch (error) { return { dem: demoDem(), simulated: true, error: error instanceof Error ? error : Error(String(error)) }; }
}
function forwardRight(heading, forward, right, speed = 1) {
  const magnitude = Math.max(1, Math.hypot(forward, right));
  return {
    x: (-Math.sin(heading) * forward + Math.cos(heading) * right) * speed / magnitude,
    z: (-Math.cos(heading) * forward - Math.sin(heading) * right) * speed / magnitude,
  };
}
function headingToward(dx, dz) { return Math.atan2(-dx, -dz); }
function pixelAt(d, col, row) {
  return col >= 0 && col < d.width && row >= 0 && row < d.height ? d.elevations_m[row][col] : null;
}
function slopeDeg(d, col, row) {
  const c = pixelAt(d, col, row), l = pixelAt(d, col - 1, row), r = pixelAt(d, col + 1, row);
  const u = pixelAt(d, col, row - 1), v = pixelAt(d, col, row + 1);
  if ([c, l, r, u, v].some(x => x === null)) return null;
  const gx = (r - l) / (2 * d.pixel_size_x_m), gz = (v - u) / (2 * d.pixel_size_y_m);
  return Math.atan(Math.hypot(gx, gz)) * (180 / Math.PI);
}
/** Illustrative nadir-camera footprint (FOV 60°); not a calibrated sensor model. */
function footprintRadiusM(altitudeM, fovDeg = 60) {
  return Math.max(0, altitudeM) * Math.tan(fovDeg * Math.PI / 360);
}
function scanDem(d, col, row, radiusM = Math.max(d.pixel_size_x_m, d.pixel_size_y_m) * 4) {
  const values = [], slopes = [], cells = [];
  // Include only existing valid cells inside the *circular* footprint.
  const rangeX = Math.ceil(radiusM / d.pixel_size_x_m), rangeY = Math.ceil(radiusM / d.pixel_size_y_m);
  for (let j = Math.max(0, row - rangeY); j <= Math.min(d.height - 1, row + rangeY); j++) {
    for (let i = Math.max(0, col - rangeX); i <= Math.min(d.width - 1, col + rangeX); i++) {
      if (((i-col)*d.pixel_size_x_m)**2 + ((j-row)*d.pixel_size_y_m)**2 > radiusM**2) continue;
      const h = pixelAt(d, i, j);
      if (h === null) continue;
      values.push(h); cells.push([i, j]);
      const slope = slopeDeg(d, i, j); if (slope !== null) slopes.push(slope);
    }
  }
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const sorted = slopes.slice().sort((a, b) => a - b);
  return {
    cells, validCount: values.length,
    minElevationM: values.length ? Math.min(...values) : null,
    maxElevationM: values.length ? Math.max(...values) : null,
    meanElevationM: values.length ? mean(values) : null,
    meanSlopeDeg: slopes.length ? mean(slopes) : null,
    p90SlopeDeg: sorted.length ? sorted[Math.floor(.9 * (sorted.length - 1))] : null,
    // Raw local elevation standard deviation, NOT detrended terrain roughness.
    roughnessStdM: values.length ? Math.sqrt(mean(values.map(x => (x - mean(values)) ** 2))) : null,
    reliefM: values.length ? Math.max(...values) - Math.min(...values) : null,
  };
}
/** Define a finite, fixed-size survey polygon inside the DEM. Pure geometry; no flight guarantees. */
const ENERGY = Object.freeze({ percentPerM: 0.016, percentPerSecond: 0.08, percentPerClimbM: 0.035, reservePercent: 12 });
function estimateEnergyPercent(distanceM, speedMPerS, ascentM = 0) {
  return distanceM * ENERGY.percentPerM + (distanceM / Math.max(1, speedMPerS)) * ENERGY.percentPerSecond
    + Math.max(0, ascentM) * ENERGY.percentPerClimbM;
}
function routeLengthM(waypoints) {
  let total = 0, last = [0, 0];
  for (const point of [...waypoints, [0, 0]]) {
    total += Math.hypot(point[0] - last[0], point[1] - last[1]); last = point;
  }
  return total;
}
/** Local DEM support check, not real obstacle detection or certified clearance. */
function terrainCellRisk(d, x, z, slopeLimitDeg = 35) {
  const i = Math.round(x / d.pixel_size_x_m + (d.width - 1) / 2);
  const j = Math.round(z / d.pixel_size_y_m + (d.height - 1) / 2);
  if (pixelAt(d,i,j) === null) return 'NO_DATA';
  const slope = slopeDeg(d,i,j);
  if (slope === null) return 'UNKNOWN_SLOPE';
  if (slope > slopeLimitDeg) return 'STEEP_TERRAIN';
  return null;
}
function segmentRisk(d, from, to, slopeLimitDeg = 35) {
  const dist = Math.hypot(to[0]-from[0],to[1]-from[1]);
  const sampleStep = Math.max(.5,Math.min(d.pixel_size_x_m,d.pixel_size_y_m)/2);
  const steps=Math.max(1,Math.ceil(dist/sampleStep));
  for(let k=0;k<=steps;k++){
    const t=k/steps;
    const risk=terrainCellRisk(d,from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t,slopeLimitDeg);
    if(risk)return risk;
  }
  return null;
}
function validateSurveyRoute(d, waypoints, slopeLimitDeg = 35) {
  let last=[0,0];
  for (const point of [...waypoints,[0,0]]) {
    const risk=segmentRisk(d,last,point,slopeLimitDeg);
    if(risk)return risk;
    last=point;
  }
  return null;
}
function planSurvey(d, options = {}) {
  const spanX = (d.width - 1) * d.pixel_size_x_m;
  const spanZ = (d.height - 1) * d.pixel_size_y_m;
  const areaFraction = Math.max(0.2, Math.min(0.65, Number(options.areaFraction) || 0.37));
  const halfX = Math.min(spanX * .55, 210) * areaFraction / 2;
  const halfZ = Math.min(spanZ * .55, 210) * areaFraction / 2;
  const tanHalfFov = Math.tan(Math.PI / 6);
  const overlap = Math.max(.2,Math.min(.7,Number.isFinite(options.overlap)?options.overlap:.35));
  const clearanceM = Math.max(8,Math.min(90,Number.isFinite(options.altitudeM)?options.altitudeM:24));
  const radiusM = footprintRadiusM(clearanceM);
  const xMin = -halfX, xMax = halfX, zMin = -halfZ, zMax = halfZ;
  const xMargin = Math.min(radiusM * 0.55, halfX * .5);
  const zMargin = Math.min(radiusM * 0.55, halfZ * .5);
  const xLeft = xMin + xMargin, xRight = xMax - xMargin;
  const startZ = zMin + zMargin, endZ = zMax - zMargin;
  const usable = Math.max(0, endZ - startZ);
  const lines = usable === 0 ? 1 : Math.max(2, Math.ceil(usable / Math.max(0.5, 2 * radiusM * (1-overlap))) + 1);
  const waypoints = [];
  for (let row = 0; row < lines; row++) {
    const z = lines === 1 ? 0 : startZ + usable * row / (lines - 1);
    if (row % 2 === 0) waypoints.push([xLeft, z], [xRight, z]);
    else waypoints.push([xRight, z], [xLeft, z]);
  }
  const valid = new Set(), nodata = new Set();
  for (let j = 0; j < d.height; j++) for (let i = 0; i < d.width; i++) {
    const x = (i - (d.width - 1) / 2) * d.pixel_size_x_m;
    const z = (j - (d.height - 1) / 2) * d.pixel_size_y_m;
    if (x < xMin || x > xMax || z < zMin || z > zMax) continue;
    const key = `${i}:${j}`;
    if (pixelAt(d, i, j) === null) nodata.add(key); else valid.add(key);
  }
  return { waypoints, valid, nodata, bounds: { xMin, xMax, zMin, zMax }, clearanceM, radiusM,
    areaM2: (xMax-xMin) * (zMax-zMin), overlap, scanIntervalM: Math.max(1,2*radiusM*(1-overlap)*.55) };
}
/** Coverage counts unique valid DEM cells inside a fixed mission area; unknowns are separate. */
function coverageSummary(plan, scanned) {
  let surveyed = 0;
  for (const key of scanned) if (plan.valid.has(key)) surveyed++;
  const total = plan.valid.size;
  const unknown = plan.nodata.size;
  return { surveyedValidCells: surveyed, validCells: total, noDataCells: unknown,
    coverageFraction: total ? surveyed / total : 0,
    unknownFraction: total + unknown ? unknown / (total + unknown) : 0,
    surveyAreaM2: plan.areaM2 };
}
// TESTABLE_CORE_END

const COPY = {
  en: { title: 'ECHO Drone Simulator', demo: 'Simulated', imported: 'Imported DEM', scan: 'Scan', auto: 'Autopilot', manual: 'Manual', reset: 'Reset', status: 'Status', source: 'Source', altitude: 'Altitude', battery: 'Battery', distance: 'Distance', coverage: 'Coverage', scans: 'Scans', mission: 'Survey mission', settings:'Survey settings', clearance:'Altitude AGL', overlap:'Overlap', area:'Area size', reason:'Outcome', estimate:'Energy estimate', progress: 'Route', noData: 'Unknown cells', startSurvey: 'Start area survey', pauseSurvey: 'Pause survey', resumeSurvey: 'Resume survey', abortSurvey: 'Abort survey', completed: 'Survey completed', pause: 'Pause', resume: 'Resume', ready: 'Ready', controls: 'W/S move · A/D strafe · Q/E turn · R/F altitude · Shift boost · Space scan · P autopilot · V camera · X reset', warning: 'Flight and scanning are simulated. Survey coverage counts unique valid DEM cells only inside the defined area; no-data remains unknown.', error: 'Unable to initialize 3D renderer' },
  fr: { title: 'Simulateur de drone ECHO', demo: 'Simulé', imported: 'MNT importé', scan: 'Scanner', auto: 'Pilote automatique', manual: 'Manuel', reset: 'Réinitialiser', status: 'Statut', source: 'Source', altitude: 'Altitude', battery: 'Batterie', distance: 'Distance', coverage: 'Couverture', scans: 'Scans', mission: 'Mission de relevé', settings:'Paramètres', clearance:'Altitude sol', overlap:'Recouvrement', area:'Zone', reason:'Résultat', estimate:'Énergie prévue', progress: 'Trajet', noData: 'Cellules inconnues', startSurvey: 'Lancer le relevé', pauseSurvey: 'Pause du relevé', resumeSurvey: 'Reprendre le relevé', abortSurvey: 'Arrêter le relevé', completed: 'Relevé terminé', pause: 'Pause', resume: 'Reprendre', ready: 'Prêt', controls: 'W/S avancer · A/D latéral · Q/E tourner · R/F altitude · Maj accélérer · Espace scan · P pilote automatique · V caméra · X réinitialiser', warning: 'Vol et scans simulés. La couverture concerne les cellules valides de la zone de relevé; les données manquantes restent inconnues.', error: 'Impossible d’initialiser le rendu 3D' },
};
const limited = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const numeric = (x, digits = 1) => Number.isFinite(x) ? x.toFixed(digits) : '—';

/** Standalone embeddable component: no router, global CSS, backend, or extra peer packages. */
export default function EchoDroneSimulator({ terrain = null, locale = 'en', keyboard = 'focus', droneModelUrl = null, onScan, onTelemetry, onError, onReset, onMissionComplete }) {
  const rootRef = useRef(null);
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const scanFnRef = useRef(() => {});
  const resetFnRef = useRef(() => {});
  const autoFnRef = useRef(() => {});
  const pauseFnRef = useRef(() => {});
  const callbackRef = useRef({ onScan, onTelemetry, onError, onReset, onMissionComplete });
  const [meta, setMeta] = useState({ simulated: true, body: 'earth', source: '' });
  const [hud, setHud] = useState({ altitudeM: 0, batteryPercent: 100, distanceM: 0, coverageFraction: 0, scanCount: 0, autopilot: false, paused: false, missionPhase: 'IDLE', missionReason: '', estimatedBatteryPercent: 0, batteryReservePercent: ENERGY.reservePercent, routeProgressFraction: 0, unknownFraction: 0, surveyedValidCells: 0, validCells: 0, noDataCells: 0, surveyAreaM2: 0 });
  const [failure, setFailure] = useState(null);
  const cameraModeRef = useRef('chase');
  const [cameraMode, setCameraMode] = useState('chase');
  const [touchControls, setTouchControls] = useState(false);
  const [surveyConfig,setSurveyConfig] = useState({altitudeM:24,overlap:.35,areaFraction:.37});
  const cameraModes = ['chase', 'fpv', 'top'];
  const cycleCamera = () => { const next = cameraModes[(cameraModes.indexOf(cameraModeRef.current) + 1) % cameraModes.length]; cameraModeRef.current = next; setCameraMode(next); }; 
  const t = COPY[locale === 'fr' ? 'fr' : 'en'];
  useEffect(() => { callbackRef.current = { onScan, onTelemetry, onError, onReset, onMissionComplete }; }, [onScan, onTelemetry, onError, onReset, onMissionComplete]);

  useEffect(() => {
    const { dem, simulated, error } = resolveTerrain(terrain);
    setMeta({ simulated, body: dem.body, source: dem.provenance.source_url });
    if (error) { callbackRef.current.onError?.(error); }
    const host = mountRef.current;
    if (!host) return undefined;
    setFailure(null);
    let renderer, scene, camera, mesh, drone, droneVisual, grid, scanMark, scannedPoints, routeLine, footprintMesh, plannedLine;
    let scanStartedAt = 0;
    let routePositions = [];
    let lastRouteSample = 0;
    let released = false, visible = true, frame = 0, previous = 0, observer, resizeObserver, gltfLoader;
    let markTimeout = 0;
    const disposables = [];
    const resources = obj => obj?.traverse?.(child => {
      if (child.geometry) child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
      materials.forEach(mat => {
        for (const val of Object.values(mat)) if (val?.isTexture) val.dispose();
        mat.dispose();
      });
    });
    try {
      const palette = dem.body === 'moon'
        ? { sky: '#070f21', fog: '#172235', low: '#444f5e', mid: '#828e9d', high: '#dce2e5', sun: '#c4d8ff', ground: '#394653' }
        : dem.body === 'mars'
          ? { sky: '#1b1822', fog: '#49352e', low: '#593e34', mid: '#a66e4d', high: '#dfb68b', sun: '#ffd2a1', ground: '#6f4b3c' }
          : { sky: '#0b1829', fog: '#223444', low: '#4d4a40', mid: '#8e7961', high: '#b7a58b', sun: '#ffe0b2', ground: '#786957' };
      scene = new THREE.Scene(); scene.background = new THREE.Color(palette.sky);
      camera = new THREE.PerspectiveCamera(61, 1, 0.15, 150000);
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.45;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // The drawing buffer is DPI-scaled. Without explicit CSS dimensions,
      // the canvas can render larger than its clipped host, causing a persistent
      // bottom-right offset even when the camera aims exactly at the drone.
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      host.appendChild(renderer.domElement);
      scene.add(new THREE.HemisphereLight(0xd6edff, 0x735442, 2.4));
      scene.add(new THREE.AmbientLight(0x658fa8, .45));
      const sun = new THREE.DirectionalLight(palette.sun, 3.0);
      sun.position.set(115, 210, -140);
      sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 1200;
      sun.shadow.bias = -0.00045;
      scene.add(sun);
      const rim = new THREE.DirectionalLight(0x63e9eb, 1.0);
      rim.position.set(-190, 90, 135); scene.add(rim);
      const spanX = (dem.width - 1) * dem.pixel_size_x_m, spanZ = (dem.height - 1) * dem.pixel_size_y_m;
      const nums = dem.elevations_m.flat().filter(Number.isFinite);
      const center = nums.length ? nums.reduce((sum, v) => sum + v, 0) / nums.length : 0;
      const rawAt = (col, row) => pixelAt(dem, col, row);
      const shown = (col, row) => ((rawAt(col, row) ?? center) - center); // no exaggeration of scientific elevations
      const worldToGrid = (x, z) => [limited(Math.round(x / dem.pixel_size_x_m + (dem.width - 1) / 2), 0, dem.width - 1), limited(Math.round(z / dem.pixel_size_y_m + (dem.height - 1) / 2), 0, dem.height - 1)];
      const heightAt = (x, z) => { const [i, j] = worldToGrid(x, z); return shown(i, j); };
      const plane = new THREE.PlaneGeometry(spanX, spanZ, dem.width - 1, dem.height - 1); plane.rotateX(-Math.PI / 2);
      const pos = plane.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const low = nums.length ? Math.min(...nums) : 0, high = nums.length ? Math.max(...nums) : 0;
      const base = new THREE.Color(palette.low), mid = new THREE.Color(palette.mid), peak = new THREE.Color(palette.high);
      for (let k = 0; k < pos.count; k++) {
        const i = k % dem.width, j = Math.floor(k / dem.width), h = rawAt(i, j);
        pos.setY(k, shown(i, j));
        const t = h === null ? 0 : limited((h-low)/Math.max(.001,high-low), 0,1);
        const color = h === null ? new THREE.Color('#293847') : t < .52 ? base.clone().lerp(mid, t / .52) : mid.clone().lerp(peak, (t - .52)/.48);
        colors[k * 3] = color.r; colors[k * 3 + 1] = color.g; colors[k * 3 + 2] = color.b;
      }
      plane.setAttribute('color', new THREE.BufferAttribute(colors, 3)); plane.computeVertexNormals();
      mesh = new THREE.Mesh(plane, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .99, metalness: 0, flatShading: false }));
      mesh.receiveShadow = true;
      scene.add(mesh);
      scene.fog = new THREE.FogExp2(palette.fog, 0.001 / Math.max(0.4, Math.min(3.0, Math.max(spanX, spanZ)/700)));
      sun.shadow.camera.left = -spanX * .7; sun.shadow.camera.right = spanX * .7;
      sun.shadow.camera.top = spanZ * .7; sun.shadow.camera.bottom = -spanZ * .7;
      sun.shadow.camera.updateProjectionMatrix();
      const undersurface = new THREE.Mesh(
        new THREE.BoxGeometry(spanX, Math.max(12, (high-low)*.18), spanZ),
        new THREE.MeshStandardMaterial({color: palette.ground, roughness:1})
      );
      undersurface.position.y = low-center - Math.max(12, (high-low)*.18)/2 - 1;
      undersurface.receiveShadow = true; scene.add(undersurface);
      // These decorative boulders are *only* created on procedural test terrain.
      // Imported DEMs retain their measured elevation surface without invented hazards.
      if (simulated) {
        const rockGeo = new THREE.DodecahedronGeometry(1, 0);
        const rockMat = new THREE.MeshStandardMaterial({ color: '#726a60', roughness: 1, flatShading: true });
        const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 240);
        rocks.castShadow = true; rocks.receiveShadow = true;
        const dummy = new THREE.Object3D();
        let seed = 919217; const rand = () => { seed = (1664525*seed + 1013904223) >>> 0; return seed / 4294967296; };
        for(let n=0;n<240;n++) {
          const x=(rand()-.5)*spanX*.95, z=(rand()-.5)*spanZ*.95;
          const scale=Math.max(.35, Math.min(spanX,spanZ)/110)*(0.3+rand()*1.65);
          dummy.position.set(x, heightAt(x,z) + scale*.12,z);
          dummy.scale.set(scale*(.8+rand()*.65),scale*(.3+rand()*.55),scale*(.65+rand()*.5));
          dummy.rotation.set(rand()*.7,rand()*6.28,rand()*.7);dummy.updateMatrix();
          rocks.setMatrixAt(n,dummy.matrix);
        }
        rocks.instanceMatrix.needsUpdate=true;
        scene.add(rocks);
      }
      grid = new THREE.GridHelper(Math.max(spanX, spanZ) * 1.23, 22, 0x527d8c, 0x263f50);
      const gridMat = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMat.forEach(m=>{m.transparent = true; m.opacity=.27;});
      grid.position.y = (nums.length ? low - center : 0) - 14; scene.add(grid);
      drone = new THREE.Group(); droneVisual = new THREE.Group(); drone.add(droneVisual); scene.add(drone);
      // Visual-only drone model: detailed camera pod, chassis, landing struts,
      // guarded rotors and navigation LEDs. All geometry is generated locally.
      const hullMat = new THREE.MeshStandardMaterial({color:'#1c3044',metalness:.64,roughness:.35});
      const trimMat = new THREE.MeshStandardMaterial({color:'#d9edf4',metalness:.7,roughness:.28});
      const tealMat = new THREE.MeshStandardMaterial({color:'#57fcf1',emissive:'#1fcac9',emissiveIntensity:2.2,roughness:.3});
      const amberMat = new THREE.MeshStandardMaterial({color:'#ffbb72',emissive:'#ff9040',emissiveIntensity:2.0,roughness:.3});
      const carbonMat = new THREE.MeshStandardMaterial({color:'#101923',metalness:.45,roughness:.38});
      const glassMat = new THREE.MeshStandardMaterial({color:'#0a1623',metalness:.82,roughness:.1});
      const mats = [hullMat,trimMat,tealMat,amberMat,carbonMat,glassMat];
      const addMesh = (geometry, material, parent, x = 0, y = 0, z = 0) => {
        const m = new THREE.Mesh(geometry, material);m.position.set(x,y,z);
        m.castShadow = true;m.receiveShadow = true;parent.add(m);return m;
      };
      const rotors = [];
      const makeBasicDrone = () => {
        const body = addMesh(new THREE.SphereGeometry(1,24,14),hullMat,droneVisual);
        body.scale.set(1.62,.43,1.12);
        const lid=addMesh(new THREE.BoxGeometry(1.3,.13,1.45),trimMat,droneVisual,0,.44,0);
        lid.rotation.y = 0;
        addMesh(new THREE.BoxGeometry(.72,.08,1.05),tealMat,droneVisual,0,.53,-.08);
        const front = addMesh(new THREE.SphereGeometry(.48,18,12),glassMat,droneVisual,0,-.26,-1.04);
        front.scale.set(1,.74,.69);
        const cam = addMesh(new THREE.CylinderGeometry(.26,.31,.42,16),trimMat,droneVisual,0,-.38,-1.40);
        cam.rotation.x=Math.PI/2;
        const lens=addMesh(new THREE.CylinderGeometry(.21,.21,.02,16),glassMat,droneVisual,0,-.39,-1.65);
        lens.rotation.x=Math.PI/2;
        for(const side of [-1,1]) {
          const strut=addMesh(new THREE.CylinderGeometry(.075,.075,1.5,9),carbonMat,droneVisual,side*1.05,-.82,.05);
          strut.rotation.z=side*.16;
          addMesh(new THREE.CylinderGeometry(.07,.07,1.95,8),trimMat,droneVisual,side*1.13,-1.43,.05).rotation.x=Math.PI/2;
        }
        for (const [x,z] of [[-2.2,-2.1],[2.2,-2.1],[-2.2,2.1],[2.2,2.1]]) {
          const arm = addMesh(new THREE.CylinderGeometry(.13,.16,Math.hypot(x,z)*.85,10),carbonMat,droneVisual,x/2,.07,z/2);
          arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(x,0,z).normalize());
          addMesh(new THREE.CylinderGeometry(.41,.34,.33,18),trimMat,droneVisual,x,.22,z);
          const rotor=new THREE.Group();rotor.position.set(x,.47,z);droneVisual.add(rotor);
          const disc = addMesh(new THREE.TorusGeometry(1.08,.037,7,38),carbonMat,rotor);
          disc.rotation.x=Math.PI/2;
          for(let k=0;k<4;k++) {
            const spoke=addMesh(new THREE.BoxGeometry(1.70,.035,.14), k%2?carbonMat:trimMat,rotor);
            spoke.rotation.y=k*Math.PI/4;
          }
          addMesh(new THREE.CylinderGeometry(.14,.14,.12,12),tealMat,rotor);
          rotors.push(rotor);
          const led=addMesh(new THREE.SphereGeometry(.10,12,10),z<0?tealMat:amberMat,droneVisual,x,.13,z);
          led.scale.set(1,1,1);
        }
        const nose=addMesh(new THREE.ConeGeometry(.3,.9,12),tealMat,droneVisual,0,.13,-1.45);
        nose.rotation.x=-Math.PI/2;
      };
      makeBasicDrone();
      // Survey dots and the flight breadcrumb path are visualization only.
      const surveyDots = new THREE.BufferGeometry();
      scannedPoints=new THREE.Points(surveyDots,new THREE.PointsMaterial({color:0x67f5df,size:Math.max(2,dem.pixel_size_x_m*.27),sizeAttenuation:true,transparent:true,opacity:.88,depthWrite:false}));
      scene.add(scannedPoints);
      // Ground footprint ring responds to AGL height; illustrative 60° viewing cone.
      footprintMesh = new THREE.Mesh(new THREE.RingGeometry(.98, 1, 72),new THREE.MeshBasicMaterial({ color:'#71e6e2', side:THREE.DoubleSide, transparent:true,opacity:.33,depthWrite:false,depthTest:false }));
      footprintMesh.rotation.x=-Math.PI/2;footprintMesh.renderOrder=7;scene.add(footprintMesh);
      const routeGeometry = new THREE.BufferGeometry();
      routeLine = new THREE.Line(routeGeometry,new THREE.LineBasicMaterial({color:'#68ded6',transparent:true,opacity:.66}));
      scene.add(routeLine);
      const plannedGeometry = new THREE.BufferGeometry();
      plannedLine = new THREE.Line(plannedGeometry, new THREE.LineBasicMaterial({ color: '#ffbf80', transparent: true, opacity: .83, depthTest: false }));
      plannedLine.renderOrder = 8;
      plannedLine.visible = false;
      scene.add(plannedLine);
      const updateSurveyDots = cells => {
        const v = [];
        for(const key of cells){const [i,j]=key.split(':').map(Number); const x=(i-(dem.width-1)/2)*dem.pixel_size_x_m,z=(j-(dem.height-1)/2)*dem.pixel_size_y_m;
          v.push(x,shown(i,j)+.58,z);
        }
        surveyDots.setAttribute('position', new THREE.Float32BufferAttribute(v,3));surveyDots.computeBoundingSphere();
      };
      const updateTrail = () => {
        routeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(routePositions.flatMap(p=>p),3));
        routeGeometry.computeBoundingSphere();
      };
      const plan = planSurvey(dem,surveyConfig);
      const state = {
        keys: new Set(), heading: 0, paused: false, battery: 100, distance: 0, seen: new Set(),
        scans: 0, lastHud: 0, waypoint: 0, phase: 'IDLE', completedMission: null,
        autoDistanceSinceScan: Infinity, routeTravelM: 0, missionReason:'', outcome:null, estimatedBatteryPercent:0,
      };
      const flight = Math.max(2, Math.min(35, Math.min(spanX, spanZ) / 45));
      const autoSpeed = Math.max(18, Math.min(36, Math.max(spanX,spanZ) / 15));
      const homeClearance = Math.max(6, Math.min(32, Math.min(spanX, spanZ) / 25));
      const homeY = heightAt(0, 0) + homeClearance;
      state.estimatedBatteryPercent=estimateEnergyPercent(routeLengthM(plan.waypoints),autoSpeed,Math.max(0,plan.clearanceM-homeClearance));
      const positionReset = () => { drone.position.set(0, homeY, 0); state.heading = 0; drone.rotation.y = 0; };
      positionReset();
      camera.position.set(0, homeY + 26, Math.min(spanZ*.13,65));
      camera.lookAt(drone.position);
      const shadowDisc=new THREE.Mesh(new THREE.CircleGeometry(5,32),new THREE.MeshBasicMaterial({color:'#07121a',transparent:true,opacity:.21,depthWrite:false,side:THREE.DoubleSide}));
      shadowDisc.rotation.x=-Math.PI/2;shadowDisc.position.set(0,heightAt(0,0)+.35,0);scene.add(shadowDisc);
      const telemetry = () => {
        const stats = coverageSummary(plan, state.seen);
        const missionActive = ['TAKEOFF','SURVEY','RETURN','LAND'].includes(state.phase);
        return { altitudeM: Math.max(0, drone.position.y-heightAt(drone.position.x,drone.position.z)),
          batteryPercent: state.battery, distanceM: state.distance, scanCount: state.scans,
          autopilot: missionActive, paused: state.paused, missionPhase: state.phase,
          missionReason: state.missionReason, estimatedBatteryPercent:state.estimatedBatteryPercent,
          batteryReservePercent:ENERGY.reservePercent,
          routeProgressFraction: state.phase === 'COMPLETE' ? 1 : state.waypoint/Math.max(1,plan.waypoints.length),
          ...stats };
      };
      const emitHud = () => {
        if (released) return;
        const h = telemetry();
        setHud(h);
        callbackRef.current.onTelemetry?.({ ...h, terrainSource: simulated ? 'SIMULATED' : 'IMPORTED_DEM',
          sourceUrl: dem.provenance.source_url, body: dem.body, simulatedFlight: true,
          positionM: { x: drone.position.x, y: drone.position.y, z: drone.position.z }, headingRad: state.heading,
          limitations: ['Battery consumption is an illustrative, uncalibrated engineering model.', 'A 35° DEM-slope stop threshold is illustrative; obstacles below the DEM resolution are undetectable.', 'Simulated flight; no obstacle-avoidance certification.', 'Coverage counts unique valid cells within the defined rectangular survey area.', 'No-data elevation cells are unobserved, not assumed safe.'] });
      };
      const performScan = (mode = 'MANUAL') => {
        if (released) return;
        const [col,row]=worldToGrid(drone.position.x,drone.position.z);
        const altitudeM=Math.max(0,drone.position.y-heightAt(drone.position.x,drone.position.z));
        const radiusM=Math.max(Math.min(dem.pixel_size_x_m,dem.pixel_size_y_m)*.75,footprintRadiusM(altitudeM));
        const result=scanDem(dem,col,row,radiusM);
        for (const [i,j] of result.cells) state.seen.add(`${i}:${j}`);
        state.scans++;
        updateSurveyDots(state.seen);
        const stats=coverageSummary(plan,state.seen);
        callbackRef.current.onScan?.({ scanId: state.scans, mode, missionPhase: state.phase,
          body: dem.body, terrainSource: simulated ? 'SIMULATED' : 'IMPORTED_DEM', simulatedFlight: true,
          sourceUrl: dem.provenance.source_url, gridPosition: {col,row},
          positionM: {x:drone.position.x,y:drone.position.y,z:drone.position.z},
          footprint: {radiusM,altitudeAGLM:altitudeM,fovDeg:60,model:'illustrative-nadir-fov'},
          metrics: {minElevationM:result.minElevationM,maxElevationM:result.maxElevationM,
            meanElevationM:result.meanElevationM,meanSlopeDeg:result.meanSlopeDeg,p90SlopeDeg:result.p90SlopeDeg,
            roughnessStdM:result.roughnessStdM,reliefM:result.reliefM,validCount:result.validCount},
          ...stats,limitations: ['Pre-existing DEM elevations only; no new sensor observation.',
            'Resolution-limited, scale-dependent and not a calibrated aerial sensor footprint.',
            'No chemical, mineral or spectral measurements are inferred.'] });
        if (scanMark) {scene.remove(scanMark);resources(scanMark);}
        scanMark=new THREE.Mesh(new THREE.RingGeometry(1,1.035,90),new THREE.MeshBasicMaterial({color:0x58ffe5,side:THREE.DoubleSide,transparent:true,opacity:.88,depthWrite:false}));
        scanStartedAt=performance.now();scanMark.rotation.x=-Math.PI/2;
        scanMark.position.set(drone.position.x,heightAt(drone.position.x,drone.position.z)+1.2,drone.position.z);
        scanMark.scale.setScalar(1);scene.add(scanMark);emitHud();
      };
      const clearResults = () => {
        state.distance=0;state.scans=0;state.seen.clear();state.waypoint=0;
        state.autoDistanceSinceScan=Infinity;state.routeTravelM=0;state.completedMission=null;state.missionReason='';state.outcome=null;
        routePositions=[];lastRouteSample=0;updateSurveyDots(state.seen);updateTrail();
        if(scanMark){scene.remove(scanMark);resources(scanMark);scanMark=null;}
        callbackRef.current.onReset?.();
      };
      const doReset=()=>{state.keys.clear();state.phase='IDLE';state.paused=false;state.battery=100;
        clearResults();positionReset();plannedLine.visible=false;emitHud();};
      const drawPlan=()=>{
        const points=[[0,homeY,0],...plan.waypoints.map(([x,z])=>[x,heightAt(x,z)+plan.clearanceM+2,z]),[0,homeY,0]];
        plannedGeometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
        plannedGeometry.computeBoundingSphere();plannedLine.visible=true;
      };
      const resultSummary = (status,reason='')=>({ ...telemetry(), status, reason, simulatedFlight:true,
        terrainSource:simulated?'SIMULATED':'IMPORTED_DEM', sourceUrl:dem.provenance.source_url,
        areaBoundsM:plan.bounds, automaticScanCount:state.scans,
        routePlannedM:routeLengthM(plan.waypoints), estimatedBatteryPercent:state.estimatedBatteryPercent,
        settings:{altitudeM:plan.clearanceM,overlap:plan.overlap,areaFraction:surveyConfig.areaFraction},
        limitations:['Battery/flight consumption is simulated, not an actual drone model.',
          'Only DEM-scale slope (illustrative 35° threshold) and no-data are checked; small obstacles remain unknown.',
          'Survey readings are from existing DEM cells; no new remote observations.'] });
      const finalizeMission=(status,reason='')=>{
        state.phase=status;state.missionReason=reason;state.paused=false;state.keys.clear();plannedLine.visible=false;
        const summary=resultSummary(status,reason);state.completedMission=summary;
        emitHud();callbackRef.current.onMissionComplete?.(summary);
      };
      const startMission=()=>{
        if(['TAKEOFF','SURVEY','RETURN','LAND'].includes(state.phase))return;
        if(['COMPLETE','ABORTED','LOW_BATTERY','UNSAFE_TERRAIN','INSUFFICIENT_BATTERY'].includes(state.phase)){
          clearResults();state.battery=100;positionReset();
        }
        const totalM=routeLengthM(plan.waypoints);
        state.estimatedBatteryPercent=estimateEnergyPercent(totalM,autoSpeed,Math.max(0,plan.clearanceM-homeClearance));
        if(!plan.valid.size){finalizeMission('UNSAFE_TERRAIN','No valid DEM cells in planned survey area');return;}
        if(state.estimatedBatteryPercent + ENERGY.reservePercent>state.battery){
          finalizeMission('INSUFFICIENT_BATTERY','Estimated mission energy exceeds simulated battery reserve');return;
        }
        const risk=validateSurveyRoute(dem,plan.waypoints);
        if(risk){finalizeMission('UNSAFE_TERRAIN',`Survey crosses ${risk}; route not certified safe`);return;}
        state.keys.clear();state.paused=false;state.waypoint=0;state.outcome=null;
        state.phase='TAKEOFF';state.missionReason='';state.autoDistanceSinceScan=Infinity;
        drawPlan();emitHud();
      };
      const abortMission=()=>{
        if(!['TAKEOFF','SURVEY','RETURN','LAND'].includes(state.phase))return;
        finalizeMission('ABORTED','Operator stopped the mission');
      };
      scanFnRef.current=()=>{if(!state.paused)performScan('MANUAL');};resetFnRef.current=doReset;
      autoFnRef.current=()=>{
        if(state.paused && ['TAKEOFF','SURVEY','RETURN','LAND'].includes(state.phase)){state.paused=false;emitHud();return;}
        if(['TAKEOFF','SURVEY','RETURN','LAND'].includes(state.phase)){abortMission();return;}
        startMission();
      };
      pauseFnRef.current=()=>{state.paused=!state.paused;state.keys.clear();emitHud();};
      const missionToward=(x,z,speed,dt)=>{
        const dx=x-drone.position.x,dz=z-drone.position.z,remaining=Math.hypot(dx,dz);
        if(remaining>1e-7){state.heading=headingToward(dx,dz);const travel=Math.min(remaining,speed*dt);
          return {x:dx/remaining*travel/dt,z:dz/remaining*travel/dt,arrived:remaining<=speed*dt+1e-5};}
        return {x:0,z:0,arrived:true};
      };
      const completeMission=()=>finalizeMission(state.outcome||'COMPLETE',state.missionReason);
      const update = dt => {
        if (state.paused || dt <= 0 || ['COMPLETE','ABORTED','UNSAFE_TERRAIN','INSUFFICIENT_BATTERY','LOW_BATTERY'].includes(state.phase)) return;
        let moveX=0,moveZ=0,dy=0;
        const active=['TAKEOFF','SURVEY','RETURN','LAND'].includes(state.phase);
        const speed=active?autoSpeed:flight*(state.keys.has('shift')?2.5:1);
        const altitudeHere=drone.position.y-heightAt(drone.position.x,drone.position.z);
        let reached=false;
        if(active){
          const targetClearance=state.phase==='LAND'?3.2:plan.clearanceM;
          const altitudeError=targetClearance-altitudeHere;
          dy=limited(altitudeError*2.5,-Math.max(15,autoSpeed*.4),Math.max(15,autoSpeed*.4));
          // Battery reserve includes predicted return energy plus fixed safety margin.
          if(state.phase==='TAKEOFF'||state.phase==='SURVEY'){
            const returnM=Math.hypot(drone.position.x,drone.position.z);
            const returnCost=estimateEnergyPercent(returnM,autoSpeed);
            if(state.battery<=returnCost+ENERGY.reservePercent){
              state.outcome='LOW_BATTERY';state.missionReason='Returned before survey completion to preserve simulated reserve';
              state.phase='RETURN';
            }
          }
          if(state.phase==='TAKEOFF'){
            if(Math.abs(altitudeError)<Math.max(1.5,dem.pixel_size_y_m*.05))state.phase='SURVEY';
          } else if(state.phase==='SURVEY'){
            const wp=plan.waypoints[state.waypoint];
            if(wp){const next=missionToward(wp[0],wp[1],autoSpeed,dt);
              moveX=next.x;moveZ=next.z;reached=next.arrived;}
            else state.phase='RETURN';
          } else if(state.phase==='RETURN'){
            const next=missionToward(0,0,autoSpeed,dt);moveX=next.x;moveZ=next.z;
            if(next.arrived)state.phase='LAND';
          } else if(state.phase==='LAND' && Math.abs(altitudeError)<.45){completeMission();}
        } else if(state.phase!=='COMPLETE'){
          const turn=(state.keys.has('q')?1:0)-(state.keys.has('e')?1:0);
          state.heading+=turn*dt*1.3;
          const forward=(state.keys.has('w')?1:0)-(state.keys.has('s')?1:0);
          const side=(state.keys.has('d')?1:0)-(state.keys.has('a')?1:0);
          ({x:moveX,z:moveZ}=forwardRight(state.heading,forward,side,speed));
          dy=((state.keys.has('r')?1:0)-(state.keys.has('f')?1:0))*speed*.6;
        }
        const oldX=drone.position.x,oldZ=drone.position.z,oldY=drone.position.y;
        const x=limited(oldX+moveX*dt,-spanX*.49,spanX*.49);
        const z=limited(oldZ+moveZ*dt,-spanZ*.49,spanZ*.49);
        if(active && ['TAKEOFF','SURVEY','RETURN'].includes(state.phase)){
          const risk=segmentRisk(dem,[oldX,oldZ],[x,z]);
          if(risk){finalizeMission('UNSAFE_TERRAIN',`Flight path has ${risk}; aircraft stopped`);return;}
        }
        const floor=heightAt(x,z);
        // Look ahead at the next DEM cell to follow ground elevation, not a fixed world Y.
        if (active && state.phase !== 'LAND') {
          const targetY=floor+plan.clearanceM;
          dy=limited((targetY-oldY)*2.5,-Math.max(15,autoSpeed*.4),Math.max(15,autoSpeed*.4));
        }
        if (active && oldY+dy*dt<floor+3) {
          finalizeMission('UNSAFE_TERRAIN','Cannot maintain 3 m modeled terrain clearance');return;
        }
        const newY=limited(oldY+dy*dt,floor+3,floor+Math.max(100,Math.min(290,spanX+spanZ)));
        drone.position.set(x,newY,z);drone.rotation.y=state.heading;
        if(state.phase==='SURVEY'){
          state.autoDistanceSinceScan+=Math.hypot(x-oldX,z-oldZ);
          const localRadius=footprintRadiusM(Math.max(0,newY-floor));
          const scanStep=Math.max(Math.min(dem.pixel_size_x_m,dem.pixel_size_y_m)*.5,localRadius*2*(1-plan.overlap)*.55);
          if(state.autoDistanceSinceScan>=scanStep){performScan('AUTO');state.autoDistanceSinceScan=0;}
          if(reached){state.waypoint++;state.autoDistanceSinceScan=Infinity;
            if(state.waypoint>=plan.waypoints.length)state.phase='RETURN';}
        }
        shadowDisc.position.set(x,floor+.42,z);
        if(footprintMesh){const r=Math.max(1,footprintRadiusM(Math.max(0,newY-floor)));
          footprintMesh.position.set(x,floor+.64,z);footprintMesh.scale.setScalar(r);}
        shadowDisc.scale.setScalar(1+Math.max(0,newY-floor)*.018);
        droneVisual.rotation.z=THREE.MathUtils.lerp(droneVisual.rotation.z,-moveX/Math.max(1,speed)*.075,Math.min(1,dt*3));
        droneVisual.rotation.x=THREE.MathUtils.lerp(droneVisual.rotation.x,moveZ/Math.max(1,speed)*.09,Math.min(1,dt*3));
        state.distance+=Math.hypot(x-oldX,z-oldZ);
        const moving=Math.hypot(moveX,moveZ,dy)>.01;
        const travelled=Math.hypot(x-oldX,z-oldZ);
        const climbed=Math.max(0,newY-oldY);
        state.battery=Math.max(0,state.battery - travelled*ENERGY.percentPerM
          - (moving?dt*ENERGY.percentPerSecond:dt*.01) - climbed*ENERGY.percentPerClimbM);
        if(state.battery<=0 && active){finalizeMission('LOW_BATTERY','Simulated battery exhausted before returning');}
        if(state.battery<=0 && !active) state.keys.clear();
      };
      const render = stamp => {
        frame = 0;
        if (released || !visible) return;
        const dt = previous ? limited((stamp - previous) / 1000, 0, .05) : 0;
        previous = stamp;
        update(dt);
        const dist = limited(Math.min(spanX, spanZ)*.09, 23, 65);
        const mode = cameraModeRef.current;
        if (mode === 'fpv') {
          camera.up.set(0, 1, 0);
          // Nose is -Z. Camera is placed just ahead of the camera pod, not inside the hull.
          const forwardX=-Math.sin(state.heading),forwardZ=-Math.cos(state.heading);
          camera.position.set(drone.position.x+forwardX*2.35,drone.position.y-.25,drone.position.z+forwardZ*2.35);
          camera.lookAt(camera.position.x+forwardX*100,camera.position.y-8,camera.position.z+forwardZ*100);
        } else if (mode === 'top') {
          // Fix a north-up map orientation: -Z is always screen-up.
          // An exact nadir view with the default camera.up=(0,1,0)
          // is degenerate and can flip as the drone moves across the target.
          camera.up.set(0, 0, -1);
          camera.position.set(drone.position.x, drone.position.y + Math.max(90, dist * 2.3), drone.position.z);
          camera.lookAt(drone.position);
        } else {
          camera.up.set(0, 1, 0);
          const follow = new THREE.Vector3(
            drone.position.x + Math.sin(state.heading) * dist,
            drone.position.y + Math.max(18, dist * .51),
            drone.position.z + Math.cos(state.heading) * dist,
          );
          camera.position.lerp(follow, Math.min(1, dt * 3.4));
          // Always point at the current drone position, not a smoothed target.
          camera.lookAt(drone.position.x, drone.position.y + 1, drone.position.z);
        }
        for(let i=0;i<rotors.length;i++)rotors[i].rotation.y+=dt*(i%2?-38:38);
        if(scanMark) {
          const age=(stamp-scanStartedAt)/1000;
          if(age>1.55) {scene.remove(scanMark);resources(scanMark);scanMark=null;}
          else {const radius=Math.max(2,dem.pixel_size_x_m*.25)+age*Math.max(9,dem.pixel_size_x_m*3.9);
            scanMark.scale.setScalar(radius);scanMark.material.opacity=.85*Math.max(0,1-age/1.55);}
        }
        if(stamp-lastRouteSample>180 && !state.paused){
          lastRouteSample=stamp;
          const last=routePositions[routePositions.length-1];
          if(!last||Math.hypot(drone.position.x-last[0],drone.position.z-last[2])>1.2){
            routePositions.push([drone.position.x,heightAt(drone.position.x,drone.position.z)+1.8,drone.position.z]);
            if(routePositions.length>450)routePositions.shift();updateTrail();
          }
        }
        if (stamp - state.lastHud > 300) { state.lastHud = stamp; emitHud(); }
        renderer.render(scene, camera);
        frame = requestAnimationFrame(render);
      };
      const size = () => { if (released) return; const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      const wake = () => { const should = visible && !document.hidden; if (should && !frame) { previous = 0; frame = requestAnimationFrame(render); } else if (!should && frame) { cancelAnimationFrame(frame); frame = 0; previous = 0; } };
      if (typeof ResizeObserver !== 'undefined') { resizeObserver = new ResizeObserver(size); resizeObserver.observe(host); }
      else window.addEventListener('resize', size);
      if (typeof IntersectionObserver !== 'undefined') { observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; wake(); }, { threshold: 0.01 }); observer.observe(host); }
      const visibilityListener = () => wake(); document.addEventListener('visibilitychange', visibilityListener);
      size(); wake(); emitHud();
      if (droneModelUrl) {
        gltfLoader = new GLTFLoader();
        gltfLoader.load(droneModelUrl, gltf => {
          if (released) { resources(gltf.scene); return; }
          const box = new THREE.Box3().setFromObject(gltf.scene); const dim = box.getSize(new THREE.Vector3());
          if (dim.length() <= 1e-6) { resources(gltf.scene); callbackRef.current.onError?.(Error('GLTF drone model is empty')); return; }
          // Model is assumed to face local -Z. We do not infer orientation from geometry.
          const scale = 5 / Math.max(dim.x, dim.y, dim.z); gltf.scene.scale.setScalar(scale);
          box.setFromObject(gltf.scene); const centerPoint = box.getCenter(new THREE.Vector3()); gltf.scene.position.sub(centerPoint);
          for (const child of [...droneVisual.children]) { droneVisual.remove(child); resources(child); }
          rotors.length = 0; droneVisual.add(gltf.scene);
        }, undefined, err => { if (!released) callbackRef.current.onError?.(err instanceof Error ? err : Error(String(err))); });
      }
      engineRef.current = state;
      return () => {
        released = true;
        if (frame) cancelAnimationFrame(frame);
        document.removeEventListener('visibilitychange', visibilityListener);
        observer?.disconnect(); resizeObserver?.disconnect();
        if (!resizeObserver) window.removeEventListener('resize', size);
        if (scanMark) { scene.remove(scanMark); resources(scanMark); }
        resources(scene);
        mats.forEach(m => m.dispose());
        disposables.forEach(x => x.dispose());
        renderer.dispose(); renderer.forceContextLoss();
        if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
        engineRef.current = null; scanFnRef.current = () => {}; resetFnRef.current = () => {}; autoFnRef.current = () => {}; pauseFnRef.current = () => {};
        if (markTimeout) clearTimeout(markTimeout);
      };
    } catch (err) {
      const message = err instanceof Error ? err : Error(String(err));
      callbackRef.current.onError?.(message); setFailure(message.message);
      if (renderer) { renderer.dispose(); renderer.forceContextLoss(); if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement); }
      return undefined;
    }
  }, [terrain, droneModelUrl, surveyConfig]);

  useEffect(() => {
    if (keyboard === 'off') return undefined;
    const keys = new Set(['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', 'shift', ' ', 'p', 'x', 'v']);
    const owner = keyboard === 'global' ? window : rootRef.current;
    if (!owner) return undefined;
    const eligible = event => {
      const el = event.target;
      return !el?.closest?.('input,textarea,select,[contenteditable="true"]');
    };
    const down = e => {
      const key = e.key.toLowerCase();
      if (!keys.has(key) || !eligible(e)) return;
      if (keyboard === 'global' && rootRef.current?.contains(e.target) && e.target?.closest?.('button')) return;
      e.preventDefault();
      const state = engineRef.current; if (!state) return;
      if (key === ' ') { if (!e.repeat) scanFnRef.current(); }
      else if (key === 'p') { if (!e.repeat) autoFnRef.current(); }
      else if (key === 'x') { if (!e.repeat) resetFnRef.current(); }
      else if (key === 'v') { if (!e.repeat) cycleCamera(); }
      else state.keys.add(key);
    };
    const up = e => engineRef.current?.keys.delete(e.key.toLowerCase());
    const clear = () => engineRef.current?.keys.clear();
    owner.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    if (keyboard === 'focus') owner.addEventListener('focusout', clear);
    return () => { owner.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); if (keyboard === 'focus') owner.removeEventListener('focusout', clear); clear(); };
  }, [keyboard]);

  const btnStyle = { border: '1px solid #39778d', borderRadius: 8, background: '#143c56', color: '#e7f7ff', padding: '7px 12px', cursor: 'pointer' };
  return <section ref={rootRef} tabIndex={keyboard === 'focus' ? 0 : undefined} aria-label={t.title} style={{ fontFamily: 'system-ui, sans-serif', background: '#0c1c2c', color: '#e7f7ff', border: '1px solid #2c4f64', borderRadius: 12, padding: 12, outlineColor: '#6bded1' }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}><strong>{t.title}</strong><span style={{ border: '1px solid #678', borderRadius: 6, padding: '3px 8px', color: meta.simulated ? '#ffce87' : '#75f3c4' }}>{meta.simulated ? t.demo : t.imported} · {meta.body.toUpperCase()}</span></div>
    <div style={{position:'relative'}}>
      <div ref={mountRef} style={{ position: 'relative', width: '100%', height: 480, overflow: 'hidden', borderRadius: 10, background: '#081a29', border:'1px solid #315363' }} aria-label="Three-dimensional drone terrain viewport" />
      <div style={{position:'absolute',left:16,top:15,pointerEvents:'none',display:'flex',gap:8,flexWrap:'wrap',fontFamily:'monospace',fontSize:11}}>
        <span style={{background:'#051928dd',border:'1px solid #2b7779',borderRadius:4,padding:'5px 9px',color:'#83f7e9',letterSpacing:1}}>● ECHO / LIVE SIM</span>
        <span style={{background:'#051928dd',border:'1px solid #355368',borderRadius:4,padding:'5px 9px',color:'#dbebf3'}}> {meta.simulated ? t.demo : t.imported}</span>
      </div>
      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',fontSize:24,color:'#b9ffee99',pointerEvents:'none',display:cameraMode==='fpv'?'block':'none'}} aria-hidden="true">⊕</div>
      <div style={{position:'absolute',left:16,bottom:18,pointerEvents:'none',background:'#051928d9',border:'1px solid #32596b',borderRadius:5,padding:'9px 11px',fontFamily:'monospace',fontSize:11,color:'#9ed9da'}}>
        <div>ALT {numeric(hud.altitudeM)} M　|　BAT {numeric(hud.batteryPercent,0)}%</div>
        <div>TRAVEL {numeric(hud.distanceM)} M　|　SURVEY {numeric(hud.coverageFraction*100)}%</div><div>MISSION {hud.missionPhase} · ROUTE {numeric(hud.routeProgressFraction*100,0)}%</div>
      </div>
      <div style={{position:'absolute',right:16,top:15,display:'grid',gap:6}}>
        <button type="button" style={{...btnStyle,background:'#071f30dd',fontSize:11}} onClick={cycleCamera}>
          CAMERA: {cameraMode.toUpperCase()} · V
        </button>
      </div>
    </div>
    {failure && <p role="alert" style={{ color: '#ffab9a' }}>{t.error}: {failure}</p>}
    <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginTop:12,padding:'9px 10px',border:'1px solid #315363',borderRadius:8,background:'#0b2335'}}>
      <strong style={{fontSize:12}}>{t.settings}</strong>
      {[
        ['altitudeM',t.clearance,12,72,6,'m',1],
        ['overlap',t.overlap,20,70,5,'%',.01],
        ['areaFraction',t.area,20,65,5,'%',.01]
      ].map(([key,label,min,max,step,unit,factor])=>{
        const active= ['TAKEOFF','SURVEY','RETURN','LAND'].includes(hud.missionPhase);
        const display=key==='altitudeM'?surveyConfig[key]:Math.round(surveyConfig[key]*100);
        return <label key={key} style={{fontSize:12,color:'#bad3df'}}>{label}: <strong style={{color:'#e4ffff'}}>{display}{unit}</strong>
          <input aria-label={label} style={{display:'block',accentColor:'#62d9d4',width:125}} type="range" min={min} max={max} step={step} disabled={active}
            value={display} onChange={e=>{callbackRef.current.onReset?.();setSurveyConfig(prev=>({...prev,[key]:Number(e.target.value)*factor}));}} /></label>;
      })}
      <span style={{fontSize:11,color:'#aac8d5'}}>Simulated battery · DEM-scale checks only</span>
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}><button type="button" style={btnStyle} onClick={() => scanFnRef.current()}>{t.scan} · Space</button><button type="button" style={btnStyle} onClick={() => autoFnRef.current()}>{hud.paused&&hud.autopilot?t.resumeSurvey:hud.autopilot?t.abortSurvey:t.startSurvey} · P</button><button type="button" disabled={hud.missionPhase==='COMPLETE'} style={btnStyle} onClick={() => pauseFnRef.current()}>{hud.paused ? t.resume : t.pause}</button><button type="button" style={btnStyle} onClick={() => resetFnRef.current()}>{t.reset} · X</button><button type="button" style={btnStyle} onClick={()=>setTouchControls(p=>!p)} aria-expanded={touchControls}>TOUCH CONTROLS {touchControls?'−':'+'}</button></div>
    {touchControls&&<div style={{display:'flex',gap:5,flexWrap:'wrap',padding:'10px 0'}}>{[['w','▲ FWD'],['s','▼ BACK'],['a','◀ LEFT'],['d','▶ RIGHT'],['q','⟲ TURN'],['e','⟳ TURN'],['r','↑ UP'],['f','↓ DOWN']].map(([key,label])=><button type="button" key={key} style={btnStyle} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);engineRef.current?.keys.add(key)}} onPointerUp={()=>engineRef.current?.keys.delete(key)} onPointerCancel={()=>engineRef.current?.keys.delete(key)} onLostPointerCapture={()=>engineRef.current?.keys.delete(key)}>{label}</button>)}</div>}
    <div style={{ display: 'flex', gap: '8px 16px', flexWrap: 'wrap', marginTop: 10, fontSize: 13 }}><span>{t.altitude}: {numeric(hud.altitudeM)} m</span><span>{t.battery}: {numeric(hud.batteryPercent, 0)}%</span><span>{t.distance}: {numeric(hud.distanceM)} m</span><span>{t.coverage}: {numeric(hud.coverageFraction * 100)}%</span><span>{t.scans}: {hud.scanCount}</span><span>{t.mission}: {hud.missionPhase}</span><span>{t.progress}: {numeric(hud.routeProgressFraction*100,0)}%</span><span>{t.noData}: {numeric(hud.unknownFraction*100,1)}%</span><span>{t.estimate}: {numeric(hud.estimatedBatteryPercent)}%</span></div>
    {hud.missionReason && <div role="status" style={{marginTop:8,padding:'9px 11px',borderRadius:7,border:'1px solid #be8854',background:'#35291d',fontSize:12,color:'#ffe0ac'}}>{t.reason}: {hud.missionPhase} — {hud.missionReason}</div>}
    <div style={{ marginTop: 8, color: '#a8c4d6', fontSize: 12, overflowWrap: 'anywhere' }}><div>{t.controls}</div><div>{t.source}: {meta.source}</div><div>{t.warning}</div></div>
  </section>;
}
