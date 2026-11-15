import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ExplorerProps } from '../../types/contracts';
import { filterCandidates, isMappable } from './model';
import './explorer.css';

export function GlobalExplorer({ sites, selectedSiteId, selectedPlanet, onSelectSite }: ExplorerProps) {
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const select = useRef(onSelectSite);
  select.current = onSelectSite;
  const previousSelection = useRef(selectedSiteId);
  const [environment, setEnvironment] = useState('All');
  const [availability, setAvailability] = useState('All');
  const [search, setSearch] = useState('');
  const [tileState, setTileState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [mapError, setMapError] = useState(false);
  const visible = useMemo(() => filterCandidates(sites, environment, availability, search), [sites, environment, availability, search]);
  const mapped = useMemo(() => visible.filter(isMappable), [visible]);
  const selected = sites.find(site => site.id === selectedSiteId);
  const hiddenSelection = selected && !visible.some(site => site.id === selected.id);
  const zoomTarget = useRef(selected);
  zoomTarget.current = hiddenSelection ? undefined : selected;
  const fittingOverview = useRef(false);
  const showAll = useCallback(() => {
    if (!mapped.length || !map.current) return;
    fittingOverview.current = true;
    try {
      map.current.fitBounds(L.latLngBounds(mapped.map(site => [site.latitude, site.longitude])), { padding: [30, 30], maxZoom: 5, animate: false });
    } finally { fittingOverview.current = false; }
  }, [mapped]);

  useEffect(() => {
    if (!host.current) return;
    let instance: L.Map | undefined;
    let observer: ResizeObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      instance = L.map(host.current, { center: [15, 15], zoom: 1, minZoom: 1, maxZoom: 16,
        scrollWheelZoom: false, worldCopyJump: false, zoomAnimation: false, fadeAnimation: false,
        maxBounds: [[-85, -180], [85, 180]], maxBoundsViscosity: 0.8 });
      map.current = instance;
      let previousZoom = instance.getZoom();
      instance.on('zoomend', () => {
        if (!instance) return;
        const zoom = instance.getZoom();
        const zoomingIn = zoom > previousZoom;
        previousZoom = zoom;
        const target = zoomTarget.current;
        if (zoomingIn && !fittingOverview.current && target && isMappable(target)) {
          instance.panTo([target.latitude, target.longitude], { animate: false });
        }
      });
      markers.current = L.layerGroup().addTo(instance);
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, noWrap: true,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      });
      let failedBatch = false;
      tiles.on('loading', () => { failedBatch = false; setTileState('loading'); });
      tiles.on('tileload', () => { clearTimeout(timer); if (!failedBatch) setTileState('ready'); });
      tiles.on('tileerror', () => { failedBatch = true; setTileState('failed'); });
      tiles.addTo(instance);
      timer = setTimeout(() => setTileState(state => state === 'loading' ? 'failed' : state), 12000);
      L.control.scale({ imperial: false }).addTo(instance);
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => instance?.invalidateSize({ pan: false }));
        observer.observe(host.current);
      }
    } catch {
      setMapError(true);
    }
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      instance?.remove();
      map.current = null;
      markers.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = markers.current;
    const instance = map.current;
    if (!layer || !instance) return;
    layer.clearLayers();
    for (const site of mapped) {
      const active = site.id === selectedSiteId;
      const marker = L.marker([site.latitude, site.longitude], {
        title: site.name, alt: `Select ${site.name}`, keyboard: true,
        icon: L.divIcon({ className: `ex-map-marker${active ? ' ex-map-marker-selected' : ''}`,
          html: '<span aria-hidden="true"></span>', iconSize: [32, 32], iconAnchor: [16, 16] })
      });
      const label = document.createElement('span');
      label.textContent = `${site.name} · ${site.dataStatus === 'READY' ? 'Data ready' : 'Data pending'}`;
      marker.bindTooltip(label, { direction: 'top' });
      marker.on('click', () => select.current(site.id));
      marker.addTo(layer);
      marker.getElement()?.setAttribute('aria-label', `Select ${site.name}`);
      marker.getElement()?.setAttribute('aria-pressed', String(active));
    }
  }, [mapped, selectedSiteId]);

  useEffect(() => { showAll(); }, [showAll]);

  useEffect(() => {
    if (previousSelection.current !== selectedSiteId && selected && isMappable(selected)) {
      map.current?.setView([selected.latitude, selected.longitude], 5, { animate: false });
    }
    previousSelection.current = selectedSiteId;
  }, [selectedSiteId, selected]);

  function resetFilters() { setEnvironment('All'); setAvailability('All'); setSearch(''); }
  return <div className="ex-explorer">
    <section className="ex-map-panel" aria-label="Earth candidate map">
      <div className="ex-panel-heading"><h2>Earth search space</h2><button type="button" onClick={showAll} disabled={!mapped.length || mapError}>Fit candidates</button></div>
      <div className="ex-map-wrap"><div className="ex-map" ref={host} role="region" aria-label="Interactive Earth map with candidate markers" tabIndex={0}/>
        {mapError && <p className="ex-map-fallback" role="alert">Map unavailable. Select a location from the candidate list.</p>}
      </div>
      <p className="ex-map-status" role="status">{mapError ? 'Map initialization failed.' : tileState === 'loading' ? 'Loading geographic basemap…' : tileState === 'failed' ? 'Some map tiles are unavailable. Markers and the location list remain usable.' : 'OpenStreetMap basemap · pan, use + / − to zoom, or pinch on touch screens.'}</p>
      <p className="ex-caption">Approximate catalog points, not study boundaries. Basemap imagery is not a scientific terrain dataset. <a href="https://www.openstreetmap.org/fixthemap">Report a map issue</a></p>
      <section className="ex-selected" aria-label="Selected candidate details" aria-live="polite">
        <div className="ex-panel-heading"><h2>{selected?.name ?? 'Choose an Earth candidate'}</h2><span className="ex-badge">{selectedPlanet === 'mars' ? 'MARS' : 'MOON'} MISSION</span></div>
        {selected ? <><p>{selected.selectionRationale}</p><div className="ex-facts"><span>{selected.country} · {selected.environmentType}</span><span>{isMappable(selected) ? `${selected.latitude}°, ${selected.longitude}°` : 'Coordinates unavailable or outside map range'}</span></div>
          <div className="ex-availability"><span className="ex-badge">{selected.dataStatus === 'READY' ? 'FEATURE DATA READY' : 'FEATURE DATA PENDING'}</span><span>{selected.datasetIds.length ? `${selected.datasetIds.length} dataset references` : 'No dataset references'}</span><span>{selected.terrainAssetUrl ? 'Terrain asset linked' : 'Terrain asset pending'}</span></div>
          {hiddenSelection && <p className="ex-warning">The selected candidate is outside your current filters. <button type="button" onClick={resetFilters}>Clear filters</button></p>}
        </> : <p>Select a marker or location to inspect evidence availability. No site has been selected.</p>}
        <p className="ex-caption">No candidates are ranked. Data readiness does not certify planetary equivalence.</p>
      </section>
    </section>
    <aside className="ex-list-panel" aria-label="Candidate filters and locations">
      <div className="ex-panel-heading"><h2>Locations</h2><span className="ex-badge">{visible.length} / {sites.length}</span></div>
      <label htmlFor={`${id}-search`}>Find a candidate</label><input id={`${id}-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, country or environment"/>
      <div className="ex-filter-grid"><div><label htmlFor={`${id}-environment`}>Environment</label><select id={`${id}-environment`} value={environment} onChange={event => setEnvironment(event.target.value)}>{['All', ...new Set(sites.map(site => site.environmentType))].map(option => <option key={option}>{option}</option>)}</select></div>
        <div><label htmlFor={`${id}-availability`}>Feature data</label><select id={`${id}-availability`} value={availability} onChange={event => setAvailability(event.target.value)}><option value="All">All statuses</option><option value="READY">Ready</option><option value="INCOMPLETE_DATA">Pending</option></select></div></div>
      <p className="ex-caption ex-results" role="status">{visible.length} candidates · {mapped.length} mapped{visible.length !== mapped.length ? ` · ${visible.length-mapped.length} with invalid or unsupported coordinates` : ''}</p>
      <div className="ex-candidates">{visible.map(site => <button type="button" key={site.id} className={`ex-candidate${site.id === selectedSiteId ? ' ex-candidate-selected' : ''}`} aria-pressed={site.id === selectedSiteId} onClick={() => onSelectSite(site.id)}><span><strong>{site.name}</strong><small>{site.country} · {site.environmentType}</small></span><span className="ex-candidate-state">{site.id === selectedSiteId ? 'Selected' : 'Select'}<small>{site.dataStatus === 'READY' ? 'Data ready' : 'Data pending'}</small></span></button>)}</div>
      {!visible.length && <div className="ex-empty"><p>{sites.length ? 'No candidates match these filters.' : 'No candidate catalog is available yet.'}</p>{sites.length > 0 && <button type="button" onClick={resetFilters}>Clear filters</button>}</div>}
      <p className="ex-caption">The catalog is the same for Mars and Moon; mission mode does not imply a validated match. Online access is needed for basemap tiles.</p>
    </aside>
  </div>;
}
