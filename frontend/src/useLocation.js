import { useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { locationError, validPoint } from './distance.js';

export default function useLocation() {
  const [position, setPosition] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function locate() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setPosition(null);
    try {
      const fix = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      if (!validPoint(fix.coords) || !Number.isFinite(fix.coords.accuracy) || fix.coords.accuracy < 0) throw new Error('Invalid GPS fix');
      if (mounted.current) setPosition({ latitude: fix.coords.latitude, longitude: fix.coords.longitude,
        accuracy: fix.coords.accuracy, timestamp: fix.timestamp || Date.now() });
    } catch (failure) {
      if (mounted.current) setError(locationError(failure));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  // A snapshot is intentionally refreshed by the user, never tracked in the background.
  useEffect(() => {
    if (!position) return;
    const expire = () => {
      if (Date.now() - position.timestamp >= 300000) {
        setPosition(null);
        setError('Your location has expired. Refresh it to update distances.');
      }
    };
    const timer = setTimeout(expire, Math.max(0, 300000 - (Date.now() - position.timestamp)));
    document.addEventListener('visibilitychange', expire);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', expire); };
  }, [position]);

  return { position, busy, error, locate, clear: () => { setPosition(null); setError(''); } };
}
