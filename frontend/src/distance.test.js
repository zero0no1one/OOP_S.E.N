import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeters, formatDistance, locationError } from './distance.js';

test('zero, known equatorial distance, and symmetry', () => {
  const a = { latitude: 0, longitude: 0 }, b = { latitude: 0, longitude: 1 };
  assert.equal(distanceMeters(a, a), 0);
  assert.ok(Math.abs(distanceMeters(a, b) - 111195) < 1);
  assert.equal(distanceMeters(a, b), distanceMeters(b, a));
});
test('short path across the date line and antipodal points remain finite', () => {
  assert.ok(distanceMeters({ latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 }) < 223);
  assert.ok(Math.abs(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 }) - 20015114.4) < 1);
});
test('missing or invalid pins never produce a fake distance', () => {
  for (const value of [null, {}, { latitude: null, longitude: null }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }]) {
    assert.equal(distanceMeters({ latitude: 13.784, longitude: 121.075 }, value), null);
  }
});
test('distance units and permission errors are readable', () => {
  assert.equal(formatDistance(5), 'Under 10 m');
  assert.equal(formatDistance(250), '250 m');
  assert.equal(formatDistance(1500), '1.5 km');
  assert.equal(formatDistance(null), '');
  assert.match(locationError({ code: 1 }), /permission was denied/);
  assert.match(locationError({ code: 'OS-PLUG-GLOC-0007' }), /Turn on/);
  assert.match(locationError({ code: 3 }), /too long/);
});
