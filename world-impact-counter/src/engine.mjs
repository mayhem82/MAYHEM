export const YEAR_SECONDS = 365 * 24 * 60 * 60;

export function quantityGauge(value) {
  if (!Number.isFinite(value) || value < 0) return null;
  // Decimal quantity axes expand with the amount; there is no severity maximum.
  const maximum = Math.min(Number.MAX_VALUE, 10 ** Math.ceil(Math.log10(Math.max(value, 1))));
  return { value, maximum, fraction:value / maximum };
}

export function isHttpsUrl(value) {
  try { return typeof value === 'string' && new URL(value).protocol === 'https:'; } catch { return false; }
}
function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
}

// Timer callbacks only repaint. Elapsed time comes from monotonic timestamps.
export class ActiveClock {
  constructor(now = () => performance.now()) {
    this.now = now;
    this.accumulated = 0;
    this.since = null;
  }
  get running() { return this.since !== null; }
  start() { if (!this.running) this.since = this.now(); }
  pause() {
    if (this.running) {
      this.accumulated += Math.max(0, this.now() - this.since);
      this.since = null;
    }
  }
  reset() { this.accumulated = 0; this.since = null; }
  seconds() {
    return (this.accumulated + (this.running ? Math.max(0, this.now() - this.since) : 0)) / 1000;
  }
}

export function validIndicator(item) {
  return Boolean(item && typeof item.id === 'string' && item.id.trim() && typeof item.name === 'string' && item.name.trim()
    && typeof item.annualRate === 'number' && Number.isFinite(item.annualRate) && item.annualRate >= 0
    && typeof item.unit === 'string' && item.unit.trim()
    && typeof item.ratePeriod === 'string' && item.ratePeriod.trim()
    && typeof item.source?.title === 'string' && item.source.title.trim()
    && isHttpsUrl(item.source?.url)
    && isIsoDate(item.source?.accessed)
    && (item.source?.published === undefined || isIsoDate(item.source.published)));
}

export function estimate(item, activeSeconds) {
  if (!validIndicator(item) || !Number.isFinite(activeSeconds) || activeSeconds < 0) return null;
  return item.annualRate * activeSeconds / YEAR_SECONDS;
}

export function trendLabel(item) {
  const trend = item?.trend;
  if (!trend || !['improving', 'worsening', 'mixed', 'stable', 'not-established'].includes(trend.direction)
    || !trend.period || !trend.note || !isHttpsUrl(trend.sourceUrl)) return 'Trend unavailable';
  return { improving: 'Improving', worsening: 'Worsening', mixed: 'Mixed', stable: 'Stable', 'not-established': 'Trend not established' }[trend.direction];
}

export function validateDataset(data) {
  if (data?.schemaVersion !== 1 || data.yearSeconds !== YEAR_SECONDS || typeof data.version !== 'string' || !data.version.trim()
    || !Array.isArray(data.indicators)) throw new Error('Unsupported or incomplete source data');
  const ids = new Set();
  for (const item of data.indicators) {
    if (!validIndicator(item) || !/^[a-z0-9][a-z0-9-]*$/.test(item.id) || ids.has(item.id)) throw new Error('Invalid or duplicate indicator');
    ids.add(item.id);
  }
  const countries = new Set();
  if (data.countries !== undefined && !Array.isArray(data.countries)) throw new Error('Invalid country coverage');
  for (const country of data.countries || []) {
    if (!/^[A-Z]{3}$/.test(country.id || '') || countries.has(country.id) || typeof country.name !== 'string' || !country.name.trim() || !Array.isArray(country.indicators)) throw new Error('Invalid country definition');
    countries.add(country.id);
    const metricIds = new Set();
    for (const item of country.indicators) {
      if (!validIndicator(item) || !/^[a-z0-9][a-z0-9-]*$/.test(item.id) || metricIds.has(item.id)) throw new Error('Invalid country indicator');
      metricIds.add(item.id);
    }
    for (const observation of country.observations || []) {
      if (!observation.name || !Number.isFinite(observation.value) || !observation.unit || !observation.referencePeriod || !isHttpsUrl(observation.source?.url) || !isIsoDate(observation.source?.accessed)) throw new Error('Invalid country observation');
    }
  }
  return data;
}

export function geographies(data) {
  return [{id:'WORLD',name:'World',indicators:data?.indicators || []},...(data?.countries || [])];
}
export function geographyKey(geographyId, indicatorId) {
  return geographyId === 'WORLD' ? indicatorId : `${geographyId}:${indicatorId}`;
}
export function datasetRates(data) {
  return geographies(data).flatMap(geography=>geography.indicators.map(item=>({...item,id:geographyKey(geography.id,item.id)})));
}

// Each rate applies prospectively. A refreshed rate never rewrites accrued totals.
export class RateLedger {
  constructor() { this.entries = new Map(); }
  update(items, seconds) {
    for (const item of items.filter(validIndicator)) {
      if (this.entries.has(item.id) && this.entries.get(item.id).unit !== item.unit) throw new Error('Unit changed; use a new indicator ID');
    }
    const activeIds = new Set(items.filter(validIndicator).map(item => item.id));
    for (const [id, entry] of this.entries) {
      entry.total += (entry.rate ?? 0) * Math.max(0, seconds - entry.since) / YEAR_SECONDS;
      entry.since = seconds;
      if (!activeIds.has(id)) entry.rate = null;
    }
    for (const item of items.filter(validIndicator)) {
      const old = this.entries.get(item.id);
      if (old && old.unit !== item.unit) throw new Error('Unit changed; use a new indicator ID');
      this.entries.set(item.id, old ? {...old, rate:item.annualRate} : {total:0, since:seconds, firstAvailable:seconds, rate:item.annualRate, unit:item.unit});
    }
  }
  value(id, seconds) {
    const entry = this.entries.get(id);
    return !entry || entry.rate === null ? null : entry.total + entry.rate * Math.max(0, seconds - entry.since) / YEAR_SECONDS;
  }
  reset(items) { this.entries.clear(); this.update(items, 0); }
}
