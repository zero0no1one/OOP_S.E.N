import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkingRouteUrl, parseWalkingRoute, routeProgress, instruction } from './navigation.js';
const fixture = { code: 'Ok', routes: [{ distance: 1112, duration: 890,
  geometry: { coordinates: [[0, 0], [.005, 0], [.01, 0]] },
  legs: [{ steps: [{ distance: 556, name: 'Campus Path', maneuver: { type: 'depart' } },
    { distance: 556, name: 'Library Lane', maneuver: { type: 'turn', modifier: 'right' } },
    { distance: 0, maneuver: { type: 'arrive' } }] }] }] };
test('uses dedicated walking server, coordinate order and bounded snapping', () => {
  const url = new URL(walkingRouteUrl({ latitude: 13, longitude: 121 }, { latitude: 14, longitude: 122 }));
  assert.equal(url.host, 'routing.openstreetmap.de');
  assert.equal(url.pathname, '/routed-foot/route/v1/foot/121,13;122,14');
  assert.equal(url.searchParams.get('radiuses'), '150;150');
  assert.throws(() => walkingRouteUrl({}, {}), /valid/);
});
test('parses route and endpoint gap; rejects missing paths and incomplete geometry', () => {
  const route = parseWalkingRoute(fixture, { latitude: 0, longitude: .01 });
  assert.equal(route.endGap, 0);
  assert.equal(route.steps[1].text, 'Turn right onto Library Lane');
  assert.throws(() => parseWalkingRoute({ code: 'NoRoute' }, {}), /No mapped/);
  assert.throws(() => parseWalkingRoute({ code: 'Ok', routes: [{ geometry: { coordinates: [] } }] }, {}), /incomplete/);
});
test('progress advances along path, detects off-route and does not overshoot destination', () => {
  const route = parseWalkingRoute(fixture, { latitude: 0, longitude: .01 });
  const half = routeProgress(route, { latitude: 0, longitude: .005, accuracy: 5 });
  assert.ok(Math.abs(half.remaining - 556) < 1);
  assert.equal(half.step, 1);
  assert.equal(half.offRoute, false);
  assert.equal(routeProgress(route, { latitude: .001, longitude: .005, accuracy: 5 }).offRoute, true);
  assert.equal(routeProgress(route, { latitude: 0, longitude: .02 }).remaining, 0);
  assert.equal(routeProgress(route, null), null);
});
test('instruction handles arrival, forks, roundabouts and U-turns', () => {
  assert.match(instruction({ maneuver: { type: 'arrive' } }), /end of the mapped route/);
  assert.equal(instruction({ maneuver: { type: 'fork', modifier: 'left' } }), 'Keep left');
  assert.match(instruction({ maneuver: { type: 'roundabout', exit: 2 } }), /exit 2/);
  assert.equal(instruction({ maneuver: { type: 'turn', modifier: 'uturn' } }), 'Turn around');
});
