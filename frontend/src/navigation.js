import { validPoint, distanceMeters } from './distance.js';
export function walkingRouteUrl(start, destination) {
  if (!validPoint(start) || !validPoint(destination)) throw new Error('Choose a valid start and destination.');
  return `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}?steps=true&geometries=geojson&overview=full&radiuses=150;150`;
}
export function instruction(step) {
  const m = step.maneuver || {}, road = step.name ? ` onto ${step.name}` : '';
  const direction = (m.modifier || 'straight').replaceAll('_', ' ');
  if (m.type === 'depart') return 'Start walking' + (step.name ? ` on ${step.name}` : ' along the path');
  if (m.type === 'arrive') return 'Reach the end of the mapped route';
  if (m.type === 'roundabout' || m.type === 'rotary') return `At the roundabout, take ${m.exit ? 'exit ' + m.exit : 'the indicated exit'}${road}`;
  if (direction === 'uturn') return 'Turn around' + road;
  if (m.type === 'fork') return 'Keep ' + direction + road;
  if (m.type === 'merge') return 'Merge ' + direction + road;
  return (direction === 'straight' ? 'Continue straight' : 'Turn ' + direction) + road;
}
export function parseWalkingRoute(data, destination) {
  if (data?.code !== 'Ok' || !data.routes?.length) throw new Error('No mapped walking route found. Try a nearby path or entrance.');
  const r = data.routes[0], points = r.geometry?.coordinates;
  if (!Array.isArray(points) || points.length < 2 || !points.every(p => Array.isArray(p) && validPoint({ longitude: p[0], latitude: p[1] }))
    || !Number.isFinite(r.distance) || r.distance < 0 || !Number.isFinite(r.duration) || r.duration < 0)
    throw new Error('The route service returned an incomplete route. Try again.');
  const rawSteps = r.legs?.flatMap(leg => leg.steps || []);
  if (!rawSteps?.length) throw new Error('Walking instructions are unavailable for this route.');
  const steps = rawSteps.map(s => ({ text: instruction(s), distance: Number.isFinite(s.distance) ? s.distance : 0 }));
  const end = points[points.length - 1];
  return { points, distance: r.distance, duration: r.duration, steps,
    endGap: distanceMeters({ latitude: end[1], longitude: end[0] }, destination) };
}
// Project GPS onto the closest route segment; never invent a route when off-path.
export function routeProgress(route, position) {
  if (!route || !validPoint(position)) return null;
  const scale = Math.cos(position.latitude * Math.PI / 180);
  let total = 0, best = Infinity, along = 0;
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i];
    const ax = (a[0] - position.longitude) * scale, ay = a[1] - position.latitude;
    const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    const gap = distanceMeters(position, { longitude: a[0] + (b[0] - a[0]) * t, latitude: a[1] + (b[1] - a[1]) * t });
    const length = distanceMeters({ longitude: a[0], latitude: a[1] }, { longitude: b[0], latitude: b[1] });
    if (gap < best) { best = gap; along = total + length * t; }
    total += length;
  }
  const travelled = total ? along / total * route.distance : 0;
  let end = 0, step = 0;
  for (let i = 0; i < route.steps.length; i++) { end += route.steps[i].distance; step = i; if (end > travelled) break; }
  return { offRoute: best > Math.max(40, position.accuracy || 0), remaining: Math.max(0, route.distance - travelled),
    step, next: Math.min(step + 1, route.steps.length - 1), toNext: Math.max(0, end - travelled), travelled };
}
