import { Link, useNavigate } from 'react-router-dom';
import { useMission } from './MissionContext';
import type { Planet } from '../types/contracts';
import './home.css';

export function HomePage() {
  const { planet, setPlanet } = useMission();
  const navigate = useNavigate();
  function explore(destination: Planet) {
    setPlanet(destination);
    navigate('/explore');
  }
  return <div className="atlas-home">
    <section className="atlas-intro" aria-labelledby="atlas-title">
      <div className="atlas-overline"><span className="atlas-beacon"/> MISSION CONTROL <span>/</span> EARTH TO OTHER WORLDS</div>
      <div className="atlas-heading">
        <p className="atlas-project">NEXORA SPACE <span>—</span></p>
        <h1 id="atlas-title">ECHO-VOID ATLAS</h1>
        <p className="atlas-tagline">Explore other worlds. <span>Start with our own.</span></p>
      </div>
      <div className="atlas-briefing">
      <p className="atlas-purpose">Find Earth environments for planetary exploration research. Compare terrain evidence, understand the limits of each analog, and rehearse reconnaissance with ECHO.</p>
      <Link className="atlas-cta" to="/explore">Explore planetary analogs <span aria-hidden="true">↗</span></Link>
      <p className="atlas-current">Destination: {planet === 'mars' ? 'Mars' : 'Moon'} <span>·</span> Select a globe to change it</p>
      </div>
    </section>

    <section className="atlas-worlds" aria-label="Earth search space and planetary destinations">
      <div className="atlas-orbit" aria-hidden="true"/>
      <article className="atlas-world atlas-earth">
        <p className="atlas-world-index">01 <span>/ SEARCH SPACE</span></p>
        <div className="atlas-globe"><img src="/planets/earth.png" width="640" height="640" alt="Illustrated Earth globe showing Africa and Europe" fetchPriority="high" decoding="async"/></div>
        <div className="atlas-world-info"><p className="atlas-coordinate">OUR TERRESTRIAL LABORATORY</p><h2>Earth<span className="atlas-source-tag">ORIGIN</span></h2><p>Extreme landscapes. Real field environments.<br/>The search for analogs begins here.</p><Link className="atlas-world-link" to="/explore">Browse Earth candidates <span aria-hidden="true">↗</span></Link></div>
      </article>
      <article className="atlas-world atlas-mars">
        <p className="atlas-world-index">02 <span>/ PLANETARY DESTINATION</span></p>
        <button className="atlas-destination" onClick={()=>explore('mars')} aria-label="Select Mars and explore Earth analogs">
          <span className="atlas-globe"><img src="/planets/mars.png" width="640" height="640" alt="Illustrated Mars globe with reddish terrain and dark surface markings" decoding="async"/></span>
          <span className="atlas-world-info"><span className="atlas-coordinate">MARS ANALOG RESEARCH</span><span className="atlas-world-name">Mars{planet==='mars'&&<span className="atlas-source-tag">SELECTED</span>}</span><span className="atlas-description">Investigate terrestrial terrain candidates<br/>for the Jezero reference target.</span><span className="atlas-world-link">Explore Mars analogs <span aria-hidden="true">↗</span></span></span>
        </button>
      </article>
      <article className="atlas-world atlas-moon">
        <p className="atlas-world-index">03 <span>/ PLANETARY DESTINATION</span></p>
        <button className="atlas-destination" onClick={()=>explore('moon')} aria-label="Select Moon and explore Earth analogs">
          <span className="atlas-globe"><img src="/planets/moon.png" width="640" height="640" alt="Illustrated Moon globe with gray craters and dark lunar maria" decoding="async"/></span>
          <span className="atlas-world-info"><span className="atlas-coordinate">LUNAR ANALOG RESEARCH</span><span className="atlas-world-name">Moon{planet==='moon'&&<span className="atlas-source-tag">SELECTED</span>}</span><span className="atlas-description">Explore Earth test environments<br/>for the south polar reference target.</span><span className="atlas-world-link">Explore lunar analogs <span aria-hidden="true">↗</span></span></span>
        </button>
      </article>
    </section>

    <details className="atlas-workflow"><summary>How the mission works</summary><section className="atlas-method" aria-label="Research workflow">
      <div><span className="atlas-method-number">01 — DISCOVER</span><h3>Find a candidate</h3><p>Browse Earth's desert, volcanic, impact and polar environments.</p></div>
      <div><span className="atlas-method-number">02 — CHARACTERIZE</span><h3>Follow the evidence</h3><p>Inspect data availability and physical, planetary, evidence and operational gaps.</p></div>
      <div><span className="atlas-method-number">03 — REHEARSE</span><h3>Run an ECHO survey</h3><p>Practice Earth-based reconnaissance on explicitly simulated terrain.</p></div>
    </section></details>
    <div className="atlas-evidence"><span className="atlas-evidence-label">EVIDENCE STATUS</span><p>Measured comparisons pending. Candidate sites are not validated equivalents. ECHO flight is an Earth-based simulation; it does not model flight in lunar vacuum.</p><Link to="/analysis">View evidence limits ↗</Link></div>
    <details className="atlas-credits"><summary>Planet imagery and credits</summary><p>Globe illustrations adapted from <a href="https://www.solarsystemscope.com/textures/">Solar System Scope</a> Earth Day Map, Mars and Moon textures, licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Adaptations: spherical projection, lighting, resizing and transparent backgrounds. Maps include adjusted colors and may include filled terrain gaps. Decorative orientation images, not scientific analysis data. Sizes and spacing are not to scale. No AI-generated imagery or NASA logos are used.</p></details>
  </div>;
}
