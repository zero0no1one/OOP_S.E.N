import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { criteria, types, categories, zones, average, mean, score, color,
  displayScore, hourLabel, isOpen, notes } from './model.js';
import CampusMap, { hasLocation, coordinates } from './CampusMap.jsx';
import useLocation from './useLocation.js';
import NavigationLink from './NavigationLink.jsx';
import NavigationScreen from './NavigationScreen.jsx';
import TimePicker from './TimePicker.jsx';
import { distanceMeters, formatDistance } from './distance.js';
import './style.css';

const native = Capacitor.isNativePlatform();
const apiOrigin = (localStorage.getItem('studyspot-api-origin') || import.meta.env.VITE_API_ORIGIN || '').trim().replace(/\/+$/, '');
const demo = new URLSearchParams(location.search).has('demo') || (native && localStorage.getItem('studyspot-mode') === 'demo');
const configure = native && (!apiOrigin && !demo || sessionStorage.getItem('studyspot-configure') === 'true');
if (native) document.documentElement.dataset.native = 'true';
const tabs = [['Explore', '⌕'], ['Map', '⌖'], ['Add spot', '+'], ['Saved', '☆']];
const ratingCount = spot => spot.ratings.length + (spot.ratings.length === 1 ? ' rating' : ' ratings');
const campusClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

async function api(path = '', payload, method = 'POST') {
  if (native) {
    const result = await CapacitorHttp.request({
      url: apiOrigin + '/api/spots' + path,
      method: payload ? method : 'GET',
      headers: payload ? { 'Content-Type': 'application/json' } : {},
      data: payload,
      connectTimeout: 10000,
      readTimeout: 15000,
    });
    if (result.status < 200 || result.status >= 300) {
      throw new Error(result.data?.message || 'Could not reach your study spot server.');
    }
    return result.data;
  }
  const response = await fetch(apiOrigin + '/api/spots' + path, payload ? {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  } : {});
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(response.status < 500 && error.message || 'The server is unavailable. Try again.');
  }
  return response.json();
}

function Distance({ position, spot }) {
  if (!position) return null;
  const meters = distanceMeters(position, spot);
  return <span className="distance">{meters === null ? 'Distance unavailable · no map pin' : formatDistance(meters) + ' away · straight-line'}</span>;
}

function Card({ spot, needs, hour, top, select, position }) {
  const value = score(spot, needs);
  const open = isOpen(spot, hour);
  return <button className={'spot' + (top && value ? ' top' : '')} onClick={() => select(spot.id)}>
    <div className="sp-main">
      {top && value > 0 && <div className="sp-tag">{needs.length ? 'Best match for your picks' : 'Top-rated spot'}</div>}
      <div className="sp-name">{spot.name}</div>
      <div className="sp-meta">{zones[spot.zone].name} · {spot.type}</div>
      <Distance position={position} spot={spot} />
      <div className="sp-row">
        <div className="fp" aria-hidden="true">{criteria.map((name, index) => {
          const rating = average(spot, index);
          return <i key={name} className={needs.length && !needs.includes(index) ? 'd' : ''}
            style={{ height: Math.max(3, rating * 6), '--c': color(rating) }} />;
        })}</div>
        <div className="sp-st">
          <span className={'dot ' + (open ? 'ok' : 'no')}>
            {open ? 'Open until ' + hourLabel(spot.closes) : 'Closed · opens ' + hourLabel(spot.opens)}
          </span>
          {spot.reports.some(report => report.status === 'open') && <span className="flag">⚑ Issue reported</span>}
        </div>
      </div>
    </div>
    <div className="sp-score"><b style={{ color: color(value) }}>{displayScore(value)}</b>
      <small>{value ? ratingCount(spot) : 'No ratings'}</small></div>
  </button>;
}

function AddSpot({ initialPin, save, busy, error }) {
  const [pin, setPin] = useState(initialPin);
  const [zone, setZone] = useState('lib');
  return <form className="pad" onSubmit={event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    save('', { name: fields.get('name'), zone, type: fields.get('type'),
      opens: Number(fields.get('opens')), closes: Number(fields.get('closes')), ...pin }, true);
  }}>
    <h1 className="hello">Add a study spot</h1>
    <label className="f" htmlFor="name">Name</label>
    <input className="in" id="name" name="name" required maxLength={100} placeholder="e.g. Library 3rd floor window" />
    <label className="f" htmlFor="zone">Location</label>
    <select className="in" id="zone" value={zone} onChange={event => setZone(event.target.value)}>
      {Object.entries(zones).map(([id, area]) => <option key={id} value={id}>{area.name}</option>)}
    </select>
    <p className="f">Pin the spot on the map</p>
    <div className="mini"><CampusMap compact drop={pin} onDrop={setPin} /></div>
    <p className="pcn">{pin ? coordinates(pin) : 'Pan and zoom, then tap to place a pin.'}</p>
    {pin && <button type="button" className="text-button" onClick={() => setPin(null)}>Clear pin</button>}
    <label className="f" htmlFor="place-type">Type of place</label>
    <select className="in" id="place-type" name="type">{types.map(type => <option key={type}>{type}</option>)}</select>
    <div className="row2"><TimePicker label="Opens" initial={8} /><TimePicker label="Closes" initial={21} /></div>
    {error && <p className="err" role="alert">{error}</p>}
    <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Add spot'}</button>
  </form>;
}

function Details({ spot, spots, hour, saved, toggleSaved, close, openForm, position, onNavigate }) {
  const value = score(spot);
  const open = isOpen(spot, hour);
  const rated = spots.filter(item => item.ratings.length);
  const reviews = spot.ratings.filter(rating => rating.review);
  return <section className="dt o" aria-label="Spot details">
    <div className="dh">
      <div className="dn"><button className="rb" onClick={close} aria-label="Back">←</button>
        <button className="rb" onClick={toggleSaved} aria-pressed={saved} aria-label="Bookmark spot">{saved ? '★' : '☆'}</button></div>
      <div className="dtitle"><h2>{spot.name}</h2><p>{zones[spot.zone].name} · {spot.type}</p>
        <p className="hrs">{hourLabel(spot.opens)} to {hourLabel(spot.closes)}
          <span className={'pill ' + (open ? 'ok' : 'no')}>{open ? 'Open now' : 'Closed'}</span></p></div>
      <div className="big"><b style={{ color: color(value) }}>{displayScore(value)}</b><span>overall<br />{ratingCount(spot)}</span></div>
    </div>
    <div className="main"><div className="pad">
      <h3 className="h3">Location</h3><p className="sub">{hasLocation(spot) ? coordinates(spot) : "This spot needs a map pin."}</p>
      <Distance position={position} spot={spot} />
      {position && <p className="pcn">Based on your last GPS update. Refresh your location after moving.</p>}
      <button className="text-button" onClick={() => openForm("location")}>{hasLocation(spot) ? "Move map pin" : "Set map location"}</button>
      <NavigationLink key={`${spot.id}:${spot.latitude}:${spot.longitude}`} spot={spot} onNavigate={onNavigate} />
      <h3 className="h3">Ratings</h3>
      <p className="sub">Bars show spot ratings. Ticks show campus averages. {notes[spot.type]}</p>
      {criteria.map((name, index) => {
        const current = average(spot, index);
        const campus = mean(rated.map(item => average(item, index)));
        return <div className="cr" key={name}><span>{name}</span>
          <div className="trk" role="img" aria-label={`${name}: ${displayScore(current)} out of 5. Campus: ${displayScore(campus)}.`}>
            <i style={{ width: current * 20 + '%', '--c': color(current) }} />
            {campus > 0 && <s style={{ left: `calc(${campus * 20}% - 1px)` }} />}</div>
          <em>{displayScore(current)}</em></div>;
      })}
      <h3 className="h3">Reviews</h3>
      {reviews.length ? reviews.map((rating, index) => {
        const value = mean(rating.scores);
        return <div className="rev" key={index}><p>{rating.review}</p>
          <small>{rating.createdAt ? new Date(rating.createdAt).toLocaleDateString() : 'Sample review'}</small>
          <b style={{ color: color(value) }}>{displayScore(value)}</b></div>;
      }) : <p className="sub">No reviews yet. Rate this spot and leave the first tip.</p>}
      {spot.reports.length > 0 && <><h3 className="h3">Reported problems</h3>
        {spot.reports.map((report, index) => <div className="prob" key={index}>
          <div>{report.category} · {report.details}</div>
          <span className={'pill ' + (report.status === 'open' ? 'no' : 'ok')}>{report.status === 'open' ? 'Open' : 'Resolved'}</span>
        </div>)}</>}
    </div></div>
    <div className="cta"><button className="btn" onClick={() => openForm('ratings')}>Rate and review</button>
      <button className="btn g" onClick={() => openForm('reports')}>Report</button></div>
  </section>;
}

function SpotForm({ spot, kind, busy, error, save, close }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  const ratings = kind === 'ratings';
  const locating = kind === 'location';
  const [location, setLocation] = useState(hasLocation(spot) ? { latitude: spot.latitude, longitude: spot.longitude } : null);
  return <dialog className="sheet modal" ref={dialog} onCancel={event => {
    event.preventDefault();
    if (!busy) close();
  }}>
    <form onSubmit={event => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      if (locating && !location) return;
      const payload = locating ? location : ratings ? {
        scores: criteria.map(name => Number(fields.get(name))), review: fields.get('review'),
      } : { category: fields.get('category'), details: fields.get('details') };
      save('/' + spot.id + '/' + kind, payload);
    }}>
      <div className="shh"><h3>{locating ? 'Set map location' : ratings ? 'Rate ' + spot.name : 'Report a problem'}</h3>
        <button type="button" className="x" disabled={busy} onClick={close} aria-label="Close">×</button></div>
      {locating ? <><p className="sub">Tap the map to position {spot.name}.</p><div className="mini"><CampusMap compact drop={location} onDrop={setLocation} /></div><p className="coord">{location ? coordinates(location) : "Select a point on the map."}</p></> : ratings ? <>
        <p className="sub">Score each category from 1 (poor) to 5 (great).</p>
        {criteria.map(name => <fieldset className="rr" key={name}><legend>{name}</legend>
          <div className="sc">{[1, 2, 3, 4, 5].map(value => <label key={value}>
            <input type="radio" name={name} value={value} required /><span>{value}</span>
          </label>)}</div></fieldset>)}
        <label className="f" htmlFor="review">Review (optional)</label>
        <textarea className="in" id="review" name="review" rows="2" maxLength={1000} />
      </> : <>
        <p className="sub">{spot.name}</p>
        <label className="f" htmlFor="category">What is wrong?</label>
        <select className="in" id="category" name="category">{categories.map(item => <option key={item}>{item}</option>)}</select>
        <label className="f" htmlFor="details">Details</label>
        <textarea className="in" id="details" name="details" rows="3" required maxLength={1000} />
      </>}
      {error && <p className="err" role="alert">{error}</p>}
      <button className="btn" disabled={busy || (locating && !location)}>{busy ? 'Saving…' : locating ? 'Save location' : ratings ? 'Submit rating' : 'Send report'}</button>
    </form>
  </dialog>;
}

function readBookmarks() {
  try {
    const stored = JSON.parse(localStorage.getItem(demo ? 'studyspot-demo-saved' : 'studyspot-saved'));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function App() {
  const gps = useLocation();
  const [destination, setDestination] = useState(null);
  const [spots, setSpots] = useState([]);
  const [tab, setTab] = useState('Explore');
  const [needs, setNeeds] = useState([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All');
  const [saved, setSaved] = useState(readBookmarks);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [drop, setDrop] = useState(null);
  const [initialPin, setInitialPin] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(!demo);
  const [clock, setClock] = useState(() => campusClock.format(new Date()));
  const [notice, setNotice] = useState('');
  const [hours, minutes] = clock.split(':').map(Number);
  const hour = hours + minutes / 60;
  const current = spots.find(spot => spot.id === selected);
  const mapSpot = spots.find(spot => spot.id === preview);
  const visible = spots.filter(spot => tab === 'Saved' ? saved.includes(spot.id)
    : (type === 'All' || spot.type === type)
      && (spot.name + ' ' + zones[spot.zone].name).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => score(b, needs) - score(a, needs));

  async function load() {
    setLoading(true);
    setLoadError('');
    try { setSpots(await api()); }
    catch { setLoadError('Could not load study spots. Check that Java and Supabase are connected.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!demo) load();
    const timer = setInterval(() => setClock(campusClock.format(new Date())), 15000);
    return () => clearInterval(timer);
  }, []);

  function navigate(next, pin = null) {
    setError('');
    setNotice('');
    setInitialPin(pin);
    setTab(next);
  }

  async function save(path, payload, adding = false) {
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    let id;
    try {
      if (demo) {
        id = adding ? Math.max(0, ...spots.map(spot => spot.id)) + 1 : selected;
        if (adding) {
          if (!payload.name.trim() || payload.closes <= payload.opens) throw new Error('Enter a name and valid opening hours.');
          setSpots([...spots, { x: null, y: null, ...payload, name: payload.name.trim(), id, ratings: [], reports: [] }]);
        } else if (form === 'location') {
          setSpots(spots.map(spot => spot.id === id ? { ...spot, ...payload } : spot));
        } else {
          if (form === 'reports' && !payload.details.trim()) throw new Error('Describe the issue before sending.');
          setSpots(spots.map(spot => spot.id !== id ? spot : form === 'ratings'
            ? { ...spot, ratings: [{ ...payload, createdAt: new Date().toISOString() }, ...spot.ratings] }
            : { ...spot, reports: [{ ...payload, status: 'open' }, ...spot.reports] }));
        }
      } else {
        ({ id } = await api(path, payload, form === 'location' ? 'PUT' : 'POST'));
        await load();
      }
      setForm(null);
      if (adding) {
        setDrop(null);
        setPreview(null);
        navigate('Explore');
        setSelected(id);
      }
      setNotice(adding ? 'Study spot added.' : form === 'location' ? 'Location saved.' : form === 'ratings' ? 'Rating submitted.' : 'Report sent.');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function bookmark() {
    const next = saved.includes(selected) ? saved.filter(id => id !== selected) : [...saved, selected];
    setSaved(next);
    try { localStorage.setItem(demo ? 'studyspot-demo-saved' : 'studyspot-saved', JSON.stringify(next)); }
    catch { setNotice('Bookmark saved for this session.'); }
  }

  const card = (spot, top = false) => <Card key={spot.id} spot={spot} needs={needs} hour={hour} top={top} select={setSelected} position={gps.position} />;

  return <div className="phone"><div className="app-content" inert={destination ? true : undefined}>
    {native && <div className="banner connection-bar"><span>{demo ? 'Demo mode' : 'StudySpot'}</span>
      <button className="text-button" onClick={() => { sessionStorage.setItem('studyspot-configure', 'true'); location.reload(); }}>Connection</button></div>}
    <div className="sb" aria-hidden="true"><span>{clock}</span><i /></div>
    {demo && <div className="banner">Demo · changes reset when you reload</div>}
    <section className="gps-panel" aria-label="Your location" inert={current ? true : undefined}>
      <div className="gps-actions"><button type="button" className="text-button" disabled={gps.busy} onClick={gps.locate}>
        {gps.busy ? 'Finding your location…' : gps.position ? 'Refresh my location' : 'Use my location'}</button>
        {gps.position && <button type="button" className="text-button" onClick={gps.clear}>Clear</button>}</div>
      <p role="status">{gps.error || (gps.position
        ? `Updated ${new Date(gps.position.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · accuracy ±${Math.ceil(gps.position.accuracy)} m. Refresh after moving.`
        : 'See straight-line distances to pinned spots. GPS is used only when you tap.')}</p>
    </section>
    {loadError && <div className="banner" role="alert">{loadError}{' '}
      <button className="text-button" onClick={load}>Retry</button>{' · '}<a href="?demo">Open demo</a></div>}
    <main className="main" key={tab} inert={current ? true : undefined}>
      {tab === 'Add spot' && <AddSpot initialPin={initialPin} save={save} busy={busy} error={error} />}
      {tab === 'Map' && <div className="mapw">
        <CampusMap spots={spots} needs={needs} drop={drop} preview={preview} userPosition={gps.position}
          onSpot={id => { setPreview(id); setDrop(null); }}
          onDrop={point => { setDrop(point); setPreview(null); }} />
        <div className="mtop"><b>Alangilan campus</b><div className="lg">
          {[[4, '4+'], [3, '3–3.9'], [2, 'Under 3']].map(([value, label]) =>
            <span key={value}><i style={{ background: color(value) }} />{label}</span>)}</div></div>
        <div className="mc">{drop ? <div className="drop"><b>New pin dropped</b><span className="sub">{coordinates(drop)}</span><div className="row2">
          <button className="btn" onClick={() => navigate('Add spot', drop)}>Add a spot here</button>
          <button className="btn g" onClick={() => setDrop(null)}>Clear pin</button></div></div>
          : mapSpot ? <div className="map-spot-preview">{card(mapSpot)}<NavigationLink key={mapSpot.id} spot={mapSpot} onNavigate={setDestination} /></div> : <div className="hint">Tap the map to add a spot. {spots.filter(spot => !hasLocation(spot)).length > 0 && <span>Some spots need a map pin. Open their details to set a location.</span>}</div>}</div>
      </div>}
      {(tab === 'Explore' || tab === 'Saved') && <div className="pad">
        {tab === 'Explore' ? <>
          <div className="wm"><span aria-hidden="true">⌖</span>StudySpot Map</div>
          <h1 className="hello">Where are you studying {hour < 12 ? 'this morning' : hour < 18 ? 'this afternoon' : 'tonight'}?</h1>
          <input className="in" type="search" placeholder="Search spots or buildings" aria-label="Search spots"
            value={query} onChange={event => setQuery(event.target.value)} />
          <div className="sec">What do you need?</div><div className="chips">
            {criteria.map((name, index) => <button key={name} className="chip" aria-pressed={needs.includes(index)}
              onClick={() => setNeeds(needs.includes(index) ? needs.filter(item => item !== index) : [...needs, index])}>{name}</button>)}
          </div>
          <div className="sec">Type of place</div><div className="seg">
            {['All', ...types].map((item, index) => <button key={item} aria-pressed={type === item}
              onClick={() => setType(item)}>{['All', 'Library', 'Cafe', 'Rooms'][index]}</button>)}
          </div>
          <div className="rh"><b>{visible.length} {visible.length === 1 ? 'spot' : 'spots'}</b>
            <span>{needs.length ? 'Ranked by your picks' : 'Ranked by overall score'}</span></div>
        </> : <h1 className="hello">Saved spots</h1>}
       
{loading ? <p role="status">Loading study spots…</p> : visible.length
  ? visible.map((spot, index) => card(spot, tab === 'Explore' && index === 0))
  : !loadError && (
      <div className="empty">
        <b>
          {tab === 'Saved'
            ? 'Nothing saved yet'
            : spots.length
              ? 'No spots match'
              : 'No study spots yet'}
        </b>

        {tab === 'Saved'
          ? 'Open a spot and bookmark it to keep it here.'
          : spots.length
            ? <>
                Clear a filter or add a spot.
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setNeeds([]);
                    setType('All');
                  }}
                >
                  Clear filters
                </button>
              </>
            : 'Tap Add spot to create the first one.'}
                 </div>
    )}
  </div>}
</main>
    
    <nav className="tabs" aria-label="Main" inert={current ? true : undefined}>
      {tabs.map(([label, icon]) => <button key={label} disabled={busy} aria-current={tab === label ? 'page' : undefined}
        onClick={() => navigate(label)}><span className="pl" aria-hidden="true">{icon}</span>{label}</button>)}
    </nav>
    {current && <Details key={current.id} spot={current} spots={spots} hour={hour} position={gps.position} onNavigate={setDestination}
      saved={saved.includes(current.id)} toggleSaved={bookmark} close={() => { setSelected(null); setNotice(''); }}
      openForm={kind => { setError(''); setNotice(''); setForm(kind); }} />}
    {current && form && <SpotForm key={form} spot={current} kind={form} busy={busy} error={error} save={save} close={() => setForm(null)} />}
    {notice && <div className="confirmation" role="status" onAnimationEnd={() => setNotice('')}>{notice}</div>}
    </div>
    {destination && <NavigationScreen spot={destination} initialPosition={gps.position} close={() => setDestination(null)} />}
  </div>;
}

function ConnectionSetup() {
  const [origin, setOrigin] = useState(apiOrigin || import.meta.env.VITE_SUGGESTED_API_ORIGIN || '');
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  async function connect(event) {
    event.preventDefault();
    setChecking(true);
    setMessage('');
    try {
      const url = new URL(origin.trim());
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/') {
        throw new Error('Enter the server address, such as http://192.168.1.10:8080.');
      }
      const result = await CapacitorHttp.get({ url: url.origin + '/api/spots', connectTimeout: 10000, readTimeout: 15000 });
      if (result.status !== 200 || !Array.isArray(result.data)) throw new Error('The server did not return study spots.');
      localStorage.setItem('studyspot-api-origin', url.origin);
      localStorage.setItem('studyspot-mode', 'live');
      sessionStorage.removeItem('studyspot-configure');
      location.reload();
    } catch (error) {
      setMessage(error.message || 'Connection failed. Check the address and Wi-Fi connection.');
    } finally { setChecking(false); }
  }
  return <div className="phone"><main className="main"><form className="pad connection-setup" onSubmit={connect}>
    <div className="wm">⌖ StudySpot Map</div><h1 className="hello">Find your place to focus.</h1>
    <p>Connect to your campus server to see shared spots and save ratings.</p>
    <label className="f" htmlFor="server">Server address</label>
    <input id="server" className="in" type="url" required value={origin} onChange={event => setOrigin(event.target.value)}
      placeholder="http://192.168.1.10:8080" autoCapitalize="none" autoCorrect="off" />
    <p className="pcn">For testing, keep this phone and the computer running StudySpot on the same Wi-Fi.</p>
    {message && <p className="err" role="alert">{message}</p>}
    <button className="btn" disabled={checking}>{checking ? 'Connecting…' : 'Connect'}</button>
    <button className="btn g" type="button" disabled={checking} onClick={() => {
      localStorage.setItem('studyspot-mode', 'demo'); sessionStorage.removeItem('studyspot-configure'); location.reload();
    }}>Try demo mode</button>
  </form></main></div>;
}

createRoot(document.getElementById('root')).render(configure ? <ConnectionSetup /> : <App />);
