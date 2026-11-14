import { walkingRouteUrl, parseWalkingRoute } from './navigation.js';
let lastRequest = 0;
export async function fetchWalkingRoute(start, destination, signal) {
  if (Date.now() - lastRequest < 1200) throw new Error('Please wait a moment before requesting another route.');
  const url = walkingRouteUrl(start, destination);
  lastRequest = Date.now();
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('The free walking-route service is unavailable. Please try again later.');
  return parseWalkingRoute(await response.json(), destination);
}
