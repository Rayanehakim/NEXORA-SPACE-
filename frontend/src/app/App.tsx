import { Component, type ReactNode } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { MissionProvider, useMission } from './MissionContext';
import { HomePage, ExplorerPage, AnalysisPage, SimulationPage, ReportPage } from './Pages';
import { sites, targets } from '../data/fixtures/catalog';
import type { Planet, MissionProfile } from '../types/contracts';
import './mission-theme.css';

class PageBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<section className="card" role="alert"><h1>This module could not load.</h1><p>Your mission selection is retained. Try another page or reload to retry.</p><Link className="button" to="/">Return home</Link></section>:this.props.children}
}
function Layout(){
  const m=useMission();
  const location=useLocation();
  return <div className={`shell ${location.pathname === '/' ? 'home-shell' : 'mission-shell'}`} data-destination={m.planet}>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="head">
      <Link to="/" className="brand-link"><div className="brand">◉ NEXORA SPACE</div><div className="subtitle">ECHO-VOID ATLAS</div></Link>
      <nav aria-label="Main navigation">{[['/','Home'],['/explore','Explorer'],['/analysis','Analysis'],['/simulation','ECHO'],['/report','Report']].map(([to,label])=><NavLink end={to==='/'} className={({isActive})=>'navlink'+(isActive?' active':'')} key={to} to={to}>{label}</NavLink>)}</nav>
    </header>
    {location.pathname !== '/' && <details className="mission-bar" key={location.pathname}>
      <summary className="mission-summary">
        <span className="mission-summary-label">MISSION</span>
        <span className="mission-summary-values">
          <span>{m.planet === 'mars' ? 'Mars' : 'Moon'}</span>
          <span>{targets.find(t=>t.id===m.targetId)?.name ?? 'No target'}</span>
          <span>{sites.find(s=>s.id===m.earthSiteId)?.name ?? 'No Earth candidate'}</span>
          <span>{m.missionProfile === 'terrain_mobility' ? 'Terrain mobility' : 'Geological survey'}</span>
        </span>
        <span className="mission-edit"><span className="mission-edit-closed">Edit mission</span><span className="mission-edit-open">Close settings</span><span aria-hidden="true">⌄</span></span>
      </summary>
      <section className="mission-settings" aria-label="Mission settings"><div className="grid">
      <div><label className="label" htmlFor="planet">Planetary destination</label><select id="planet" className="select" value={m.planet} onChange={e=>m.setPlanet(e.target.value as Planet)}>{(['mars','moon'] as const).map(p=><option key={p} value={p}>{p.toUpperCase()}</option>)}</select></div>
      <div><label className="label" htmlFor="target">Target region</label><select id="target" className="select" value={m.targetId} onChange={e=>m.setTargetId(e.target.value)}>{targets.filter(t=>t.body===m.planet).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      <div><label className="label" htmlFor="site">Earth candidate</label><select id="site" className="select" value={m.earthSiteId??''} onChange={e=>m.setEarthSiteId(e.target.value)}>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div><label className="label" htmlFor="objective">Mission objective</label><select id="objective" className="select" value={m.missionProfile} onChange={e=>m.setMissionProfile(e.target.value as MissionProfile)}><option value="terrain_mobility">Terrain mobility</option><option value="geological_survey">Geological survey</option></select></div>
    </div><small>Selections remain active between pages for this session. Changing mission settings clears the previous survey. Measured terrain data is pending.</small></section></details>}
    <main id="main" tabIndex={-1}><PageBoundary key={location.pathname}><Routes>
      <Route path="/" element={<HomePage/>}/><Route path="/explore" element={<ExplorerPage/>}/>
      <Route path="/analysis" element={<AnalysisPage/>}/><Route path="/simulation" element={<SimulationPage/>}/><Route path="/report" element={<ReportPage/>}/>
      <Route path="*" element={<section className="card"><h1>Page not found.</h1><p>Choose a mission step from the navigation.</p><Link className="button" to="/">Return home</Link></section>}/>
    </Routes></PageBoundary></main>
    <footer className="muted" style={{marginTop:30,fontSize:12}}>Independent research prototype · Not NASA-certified · Measured, simulated and unavailable evidence must remain distinct.</footer>
  </div>;
}
export default function App(){return <BrowserRouter><MissionProvider><Layout/></MissionProvider></BrowserRouter>}
