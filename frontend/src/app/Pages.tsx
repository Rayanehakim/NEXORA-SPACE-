import { lazy, Suspense, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { sites, targets } from '../data/fixtures/catalog';
import { AnalysisDashboard } from '../features/analysis';
import { MissionReport } from '../features/report';
import { useComparison } from '../features/analysis/useComparison';
import { useMission } from './MissionContext';
import { DroneAdapter } from './DroneAdapter';
import './pages.css';
export { HomePage } from './HomePage';
function PageHeader({step,title,children}:{step:string;title:string;children?:ReactNode}){return <header className="page-heading"><div><p className="eyebrow">{step}</p><h1>{title}</h1></div><div className="page-actions">{children}</div></header>}
const GlobalExplorer = lazy(() => import('../features/explorer').then(module => ({default:module.GlobalExplorer})));
export function ExplorerPage(){const m=useMission();return <div className="workspace-page"><PageHeader step="01 / DISCOVER" title="Earth analog explorer"><Link className="button" to="/analysis">Inspect evidence →</Link></PageHeader><Suspense fallback={<p role="status">Loading Earth explorer…</p>}><GlobalExplorer sites={sites} selectedSiteId={m.earthSiteId} selectedPlanet={m.planet} onSelectSite={m.setEarthSiteId}/></Suspense></div>}
export function AnalysisPage(){const m=useMission();const target=targets.find(t=>t.id===m.targetId)??null;const site=sites.find(s=>s.id===m.earthSiteId)??null;const comparison=useComparison(m.targetId,m.earthSiteId,m.missionProfile);return <div className="workspace-page"><PageHeader step="02 / UNDERSTAND" title="Terrain evidence"><Link className="button" to="/simulation">Rehearse a survey →</Link></PageHeader><AnalysisDashboard target={target} site={site} comparison={comparison}/></div>}
export function SimulationPage(){const m=useMission();return <div className="workspace-page simulation-page"><PageHeader step="03 / REHEARSE" title="ECHO reconnaissance"><Link className="button" to="/report">Open report →</Link></PageHeader><p className="simulation-disclosure"><span className="data-chip">SIMULATED</span> {sites.find(s=>s.id===m.earthSiteId)?.name} mission · Earth-based simulated flight · terrain type and provenance shown below.</p><DroneAdapter key={`${m.earthSiteId}:${m.targetId}:${m.missionProfile}`} siteId={m.earthSiteId!} onReport={m.setSimulationReport}/></div>}
export function ReportPage(){const m=useMission();const target=targets.find(t=>t.id===m.targetId)??null;const site=sites.find(s=>s.id===m.earthSiteId)??null;const comparison=useComparison(m.targetId,m.earthSiteId,m.missionProfile);return <div className="workspace-page report-page"><PageHeader step="04 / MISSION RECORD" title="Mission brief"/><MissionReport target={target} site={site} comparison={comparison} simulation={m.simulationReport} objective={m.missionProfile}/></div>}
