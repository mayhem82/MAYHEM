import { NOAA_URL, ObservationStore } from './noaa-parser.mjs';
export function initNoaa() {
  const store = new ObservationStore();
  const $ = id => document.getElementById(id);
  const cacheKey = 'world-impact-noaa-v1';
  const HOUR = 3600000;
  let active = false, busy = false, lastAttempt = -Infinity;
  try {
    const cache = JSON.parse(localStorage.getItem(cacheKey));
    if (cache?.csv && !Number.isNaN(Date.parse(cache.checkedAt))) {
      store.accept(cache.csv, new Date(cache.checkedAt));
      store.error = 'Cached snapshot; awaiting a fresh successful check.';
    }
  } catch { /* Invalid cache never becomes a measurement. */ }
  function paint() {
    const snapshot = store.snapshot;
    $('noaa-value').textContent = snapshot ? `${snapshot.trend.toFixed(2)} ppm` : 'Unavailable';
    $('noaa-date').textContent = `Data date: ${snapshot?.date || 'unavailable'}`;
    $('noaa-trend').textContent = 'Seasonally adjusted global trend estimate';
    $('noaa-checked').textContent = `Last successful NOAA fetch: ${store.lastChecked ? new Date(store.lastChecked).toLocaleString() : 'not yet'}`;
    $('noaa-state').textContent = store.error ? `Check failed / cached data may be stale: ${store.error}` : snapshot ? 'Official feed checked successfully. Daily estimates, not a live sensor.' : 'Press Start or Check NOAA to fetch the official daily estimate.';
    $('noaa-state').className = store.error ? 'error' : '';
  }
  async function refresh() {
    active = true;
    if (busy) return;
    busy = true; lastAttempt = performance.now(); $('noaa-refresh').disabled = true;
    $('noaa-state').textContent = 'Fetching official NOAA feed...';
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(NOAA_URL, {mode:'cors', credentials:'omit', cache:'no-store', signal:controller.signal});
      if (!response.ok) throw new Error(`NOAA HTTP ${response.status}`);
      const csv = await response.text(); store.accept(csv);
      try { localStorage.setItem(cacheKey, JSON.stringify({csv, checkedAt:store.lastChecked})); } catch { /* Session snapshot still available. */ }
    } catch (error) { store.fail(error); }
    finally { clearTimeout(timeout); busy = false; $('noaa-refresh').disabled = false; paint(); }
  }
  $('noaa-refresh').addEventListener('click', refresh);
  setInterval(() => { if (active && performance.now() - lastAttempt >= HOUR) refresh(); }, HOUR);
  document.addEventListener('visibilitychange', () => { if (active && !document.hidden && performance.now() - lastAttempt >= HOUR) refresh(); });
  paint(); return {refresh};
}
