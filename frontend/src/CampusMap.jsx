import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { score, displayScore, level } from './model.js';

export const campusCenter = [13.78422908, 121.0748811];
export const hasLocation = spot => Number.isFinite(spot?.latitude) && Number.isFinite(spot?.longitude);
export const coordinates = point => point.latitude.toFixed(6) + ', ' + point.longitude.toFixed(6);

export default function CampusMap({ spots = [], needs = [], drop, onDrop, onSpot, preview, compact, userPosition, route, routeDestination, followUser }) {
  const container = useRef(null);
  const instance = useRef(null);
  const callbacks = useRef({ onDrop, onSpot });
  callbacks.current = { onDrop, onSpot };
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    const initial = hasLocation(drop) ? [drop.latitude, drop.longitude] : campusCenter;
    const map = L.map(container.current, { zoomControl: false }).setView(initial, 17);
    instance.current = map;
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>');
    L.control.zoom({ position: 'topleft' }).addTo(map);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, minZoom: 3,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    tiles.on('tileerror', () => setTileError(true));
    map.on('click', event => {
      const point = event.latlng.wrap();
      callbacks.current.onDrop?.({ latitude: Math.max(-85.05112878, Math.min(85.05112878, point.lat)), longitude: point.lng });
    });
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); instance.current = null; };
  }, []);

  useEffect(() => {
    const layer = L.layerGroup().addTo(instance.current);
    for (const spot of spots.filter(hasLocation)) {
      const value = score(spot, needs);
      const icon = L.divIcon({
        className: 'map-marker ' + level(value) + (preview === spot.id ? ' selected-marker' : ''),
        html: '<span>' + displayScore(value) + '</span>',
        iconSize: [40, 40], iconAnchor: [20, 40],
      });
      const tooltip = document.createElement('span');
      tooltip.textContent = spot.name;
      L.marker([spot.latitude, spot.longitude], { icon, title: spot.name, alt: spot.name })
        .bindTooltip(tooltip).on('click', () => callbacks.current.onSpot?.(spot.id)).addTo(layer);
    }
    if (hasLocation(drop)) {
      L.marker([drop.latitude, drop.longitude], {
        icon: L.divIcon({ className: 'map-marker new-marker', html: '<span>+</span>', iconSize: [40, 40], iconAnchor: [20, 40] }),
        title: 'Selected location',
      }).addTo(layer);
    }
    return () => layer.remove();
  }, [spots, needs, drop, preview]);

  useEffect(() => {
    if (!hasLocation(userPosition)) return;
    const map = instance.current;
    const point = [userPosition.latitude, userPosition.longitude];
    const layer = L.layerGroup().addTo(map);
    L.circle(point, { radius: userPosition.accuracy, color: '#087f56', weight: 1,
      fillOpacity: 0.08, interactive: false }).addTo(layer);
    L.circleMarker(point, { radius: 8, color: '#ffffff', weight: 3, fillColor: '#087f56',
      fillOpacity: 1, bubblingMouseEvents: false }).bindTooltip('Your last GPS location').addTo(layer);
    if (!route || followUser) map.setView(point, 17);
    return () => layer.remove();
  }, [userPosition, route, followUser]);

  useEffect(() => {
    const map = instance.current;
    if (!route) {
      if (hasLocation(routeDestination)) map.setView([routeDestination.latitude, routeDestination.longitude], 17);
      return;
    }
    const layer = L.layerGroup().addTo(map);
    const line = L.polyline(route.points.map(([lon, lat]) => [lat, lon]), { color: '#b30b35', weight: 6, opacity: .9, interactive: false }).addTo(layer);
    const first = route.points[0];
    L.circleMarker([first[1], first[0]], { radius: 6, color: '#fff', weight: 2, fillColor: '#087f56', fillOpacity: 1 }).bindTooltip('Route start').addTo(layer);
    map.fitBounds(line.getBounds(), { padding: [25, 25], maxZoom: 18 });
    return () => layer.remove();
  }, [route, routeDestination]);

  return <div className={'real-map ' + (compact ? 'compact-map' : '')}>
    <div ref={container} className="leaflet-map" aria-label="Alangilan campus map. Tap to choose a location." />
    <button type="button" className="campus-reset" onClick={() => instance.current.setView(campusCenter, 17)}>Alangilan</button>
    {tileError && <div className="map-error" role="status">Map tiles could not load. Check your internet connection.
      <button type="button" onClick={() => { setTileError(false); instance.current.eachLayer(layer => { if (layer instanceof L.TileLayer) layer.redraw(); }); }}>Retry</button>
    </div>}
  </div>;
}
