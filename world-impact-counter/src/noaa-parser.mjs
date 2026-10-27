export const NOAA_URL = 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_trend_gl.csv';
export function parseNoaa(csv, now = new Date()) {
  if (typeof csv !== 'string' || csv.length > 5_000_000) throw new Error('Invalid NOAA CSV size');
  const lines = csv.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  const columns = lines.shift()?.split(',').map(s => s.trim());
  if (columns?.join(',') !== 'year,month,day,smoothed,trend') throw new Error('Unexpected NOAA CSV schema');
  let latest = null;
  for (const line of lines) {
    const cells = line.split(',').map(s => s.trim());
    if (cells.length !== 5 || cells.some(s => s === '' || !Number.isFinite(Number(s)))) throw new Error('Malformed NOAA CSV row');
    const [year, month, day, smoothed, trend] = cells.map(Number);
    if (!Number.isInteger(year) || year < 1958 || year > now.getUTCFullYear() + 1 || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) throw new Error('Invalid NOAA observation date');
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || date > new Date(now.getTime() + 86400000)) throw new Error('Invalid or future NOAA date');
    // NOAA missing-value sentinels are never displayed as a zero or observation.
    if (smoothed <= -99 || trend <= -99) continue;
    if (smoothed < 250 || smoothed > 1000 || trend < 250 || trend > 1000) throw new Error('NOAA concentration outside validation range');
    const record = {date:date.toISOString().slice(0,10), smoothed, trend};
    if (!latest || record.date > latest.date) latest = record;
  }
  if (!latest) throw new Error('No valid NOAA observations');
  return latest;
}

export class ObservationStore {
  constructor() { this.snapshot = null; this.lastChecked = null; this.error = null; }
  accept(csv, checkedAt = new Date()) {
    const snapshot = parseNoaa(csv, checkedAt);
    if (this.snapshot && snapshot.date < this.snapshot.date) throw new Error('NOAA data date regressed');
    this.snapshot = snapshot; this.lastChecked = checkedAt.toISOString(); this.error = null;
  }
  fail(error) { this.error = error.message || 'Fetch failed'; }
}
