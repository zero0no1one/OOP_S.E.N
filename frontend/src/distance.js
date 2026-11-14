export function validPoint(point) {
  return Number.isFinite(point?.latitude) && Math.abs(point.latitude) <= 90
    && Number.isFinite(point?.longitude) && Math.abs(point.longitude) <= 180;
}

// Great-circle distance on Earth, in metres. No network service is needed.
export function distanceMeters(from, to) {
  if (!validPoint(from) || !validPoint(to)) return null;
  const rad = degrees => degrees * Math.PI / 180;
  const dLat = rad(to.latitude - from.latitude);
  const dLon = rad(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters < 0) return '';
  if (meters < 10) return 'Under 10 m';
  if (meters < 1000) return Math.round(meters) + ' m';
  return (meters / 1000).toFixed(1) + ' km';
}

export function locationError(error) {
  if (error?.code === 1 || error?.code === 'OS-PLUG-GLOC-0003')
    return 'Location permission was denied. Allow location in your app or browser settings, then try again.';
  if (error?.code === 3 || error?.code === 'OS-PLUG-GLOC-0010')
    return 'Getting your location took too long. Move near a window or outdoors and try again.';
  if (error?.code === 'OS-PLUG-GLOC-0007' || error?.code === 'OS-PLUG-GLOC-0009')
    return 'Turn on your device’s Location services, then try again.';
  return 'Could not get your location. Check location permissions and GPS, then try again. Browser GPS needs HTTPS or localhost.';
}
