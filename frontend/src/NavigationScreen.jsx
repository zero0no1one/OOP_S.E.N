import { useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import CampusMap from './CampusMap.jsx';
import { formatDistance, validPoint, locationError, distanceMeters } from './distance.js';
import { fetchWalkingRoute } from './routeClient.js';
import { routeProgress } from './navigation.js';
export default function NavigationScreen({ spot, initialPosition, close }) {
  const [start, setStart] = useState(initialPosition && Date.now() - initialPosition.timestamp < 300000 ? initialPosition : null);
  const [position, setPosition] = useState(null), [route, setRoute] = useState(null);
  const [choosing, setChoosing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [tracking, setTracking] = useState(false), [tick, setTick] = useState(Date.now());
  const controller = useRef(null), mounted = useRef(true), pending = useRef(false);
  useEffect(() => () => { mounted.current = false; controller.current?.abort(); }, []);
  useEffect(() => { const timer = setInterval(() => setTick(Date.now()), 5000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!tracking) return;
    let disposed = false, watch;
    const stopHidden = () => { if (document.hidden) { setTracking(false); setError('Live guidance paused. Tap Start live guidance when ready.'); } };
    document.addEventListener('visibilitychange', stopHidden);
    Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0, minimumUpdateInterval: 3000 }, (fix, failure) => {
      if (disposed) return;
      if (failure) { setError(locationError(failure)); setTracking(false); return; }
      if (validPoint(fix?.coords) && Number.isFinite(fix.coords.accuracy)) {
        setPosition({ latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy, timestamp: fix.timestamp }); setError('');
      }
    }).then(id => { if (disposed) Geolocation.clearWatch({ id }).catch(() => {}); else watch = id; })
      .catch(failure => { if (!disposed) { setError(locationError(failure)); setTracking(false); } });
    return () => { disposed = true; document.removeEventListener('visibilitychange', stopHidden); if (watch) Geolocation.clearWatch({ id: watch }).catch(() => {}); };
  }, [tracking]);
  async function getRoute(useGps) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(''); setTracking(false); setRoute(null); setPosition(null);
    let timeout;
    try {
      let origin = start;
      if (useGps) {
        const fix = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        if (!mounted.current) return;
        origin = { latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy, timestamp: fix.timestamp };
        if (!validPoint(origin)) throw new Error('A GPS location could not be found.');
        if (origin.accuracy > 150) throw new Error('GPS is too approximate for campus routing. Allow precise location or choose a start on the map.');
        setStart(origin); setPosition(origin);
      }
      if (!validPoint(origin)) throw new Error('Choose your starting point first.');
      controller.current = new AbortController();
      timeout = setTimeout(() => controller.current.abort(), 20000);
      const result = await fetchWalkingRoute(origin, spot, controller.current.signal);
      if (mounted.current) { setRoute(result); setChoosing(false); }
    } catch (failure) {
      if (mounted.current) setError(failure.code && failure.name !== 'AbortError' ? locationError(failure) : failure.name === 'AbortError'
        ? 'The route request timed out. Check your connection and try again.' : failure.message || 'Could not load a walking route.');
    } finally { clearTimeout(timeout); pending.current = false; if (mounted.current) setBusy(false); }
  }
  const fresh = position && tick - position.timestamp < 30000 && position.accuracy <= 75;
  const progress = fresh ? routeProgress(route, position) : null;
  const arrived = progress && !progress.offRoute && progress.remaining < 25 && position.accuracy <= 30 && distanceMeters(position, spot) < 25;
  const guide = arrived ? 'You are near the destination pin.' : progress?.offRoute ? 'You are away from the route. Recalculate from GPS.'
    : progress ? progress.travelled < 15 ? route.steps[0].text : `In ${formatDistance(progress.toNext)}: ${route.steps[progress.next].text}`
    : tracking ? 'Waiting for an accurate GPS location…' : 'Route preview · start live guidance to follow your position.';
  return <section className="navigation-screen" aria-label="Walking navigation">
    <header className="navigation-header"><button type="button" className="rb" aria-label="Close navigation" onClick={close}>←</button><div><b>Walk to {spot.name}</b><p>Stay in StudySpot</p></div></header>
    <div className="navigation-map"><CampusMap spots={[spot]} userPosition={position} route={route} routeDestination={spot}
      drop={choosing ? start : null} followUser={tracking} onDrop={choosing && !busy ? point => { setStart(point); setRoute(null); } : undefined} />
      {choosing && <div className="route-map-hint">Tap the map to choose your starting point.</div>}</div>
    <div className="navigation-panel">
      {error && <p className="err" role="alert">{error}</p>}
      {!route ? <><p className="pcn">Getting a route sends your start and destination to the free FOSSGIS walking-route service.</p>
        <div className="row2"><button type="button" className="btn" disabled={busy} onClick={() => getRoute(true)}>{busy ? 'Finding route…' : 'Use GPS & route'}</button>
        <button type="button" className="btn g" disabled={busy} onClick={() => { setChoosing(true); setStart(null); }}>Choose start on map</button></div>
        {start && <button type="button" className="btn" disabled={busy} onClick={() => getRoute(false)}>Get walking route</button>}</>
        : <><div className="route-summary"><b>{formatDistance(route.distance)} · about {Math.max(1, Math.round(route.duration / 60))} min walk</b></div>
          <p className="route-guidance" role="status">{guide}</p>
          {position && <p className="pcn">GPS accuracy ±{Math.ceil(position.accuracy)} m{!fresh ? ' · location is approximate or out of date' : ''}</p>}
          <div className="row2"><button type="button" className="btn" onClick={() => { setError(''); setTracking(!tracking); }}>{tracking ? 'Pause guidance' : 'Start live guidance'}</button>
          <button type="button" className="btn g" disabled={busy} onClick={() => getRoute(true)}>Recalculate</button></div>
          <details className="route-directions"><summary>Walking directions ({route.steps.length})</summary><ol>{route.steps.map((step, i) => <li key={i} aria-current={progress?.step === i ? 'step' : undefined}>{step.text}{step.distance > 0 && <span> · {formatDistance(step.distance)}</span>}</li>)}</ol></details>
          {route.endGap > 20 && <p className="pcn">The mapped path ends {formatDistance(route.endGap)} from the spot. Follow posted campus access signs for the final section.</p>}
        </>}
      <p className="routing-credit">Routes: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer">FOSSGIS / OSRM</a> · © OpenStreetMap contributors · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Fix the map</a></p>
    </div></section>;
}
