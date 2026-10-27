import { ActiveClock, YEAR_SECONDS, trendLabel, isHttpsUrl } from './engine.mjs';
import { DatasetStore } from './data-store.mjs';
import { initNoaa } from './noaa.mjs';
import { createQuantityGauge } from './gauge.mjs';

const clock = new ActiveClock();
const store = new DatasetStore();
const $ = id => document.getElementById(id);
const POLL_MS = 5 * 60 * 1000;
let lastAttempt = -Infinity;
let refreshing = false;
let started = false;
let downloadUrl;
const nodes = new Map();
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function link(title, url) {
  const node = el('a', '', title);
  node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer';
  return node;
}
function empty(message) {
  const box = el('div', 'empty');
  box.append(el('div', 'empty-icon', '\u25cc'), el('h3', '', 'Verified inputs unavailable'), el('p', '', message));
  $('indicators').replaceChildren(box);
}
function renderIndicators() {
  $('indicators').replaceChildren(); nodes.clear();
  for (const item of store.data.indicators) {
    const card = el('article', `indicator ${item.id}`);
    const top = el('div', 'indicator-top');
    const label = trendLabel(item);
    top.append(el('h3', '', item.name), el('span', `trend ${item.trend?.direction || ''}`, label));
    const value = el('div', 'estimate', 'Unavailable');
    const gauge = createQuantityGauge(item.unit);
    card.append(top, gauge.element, value, el('div', 'estimate-unit', `${item.unit} \u00b7 estimated since Start`));
    card.append(el('p', 'gauge-note', 'Auto-scaled quantity axis. Position is not severity or trend.'));
    card.append(el('p', 'reference-period', `Data period: ${item.ratePeriod}`));
    if (store.ledger.entries.get(item.id).firstAvailable > 0) card.append(el('p', '', 'Excludes active time before this rate became available.'));
    const details = el('details');
    details.append(el('summary', '', 'Source & assumptions'), el('p', '', `Current annual rate: ${number.format(item.annualRate)} ${item.unit} (${number.format(item.annualRate / YEAR_SECONDS)}/second)`));
    details.append(link(item.source.title, item.source.url), el('p', '', `Published ${item.source.published || 'not specified'} \u00b7 Verified ${item.source.accessed}`));
    if (item.scope) details.append(el('p', '', `Coverage: ${item.scope}`));
    details.append(el('p', '', item.limitations || 'Constant-rate approximation; actual events vary over time.'));
    if (item.trend?.note && isHttpsUrl(item.trend.sourceUrl)) details.append(el('p', '', `Trend (${item.trend.period}): ${item.trend.note}`), link('Trend source', item.trend.sourceUrl));
    card.append(details); nodes.set(item.id, {value,gauge}); $('indicators').append(card);
  }
  if (!store.data.indicators.length) empty('No verified annual rates are provided. The timer still works; no indicator amounts are invented.');
  $('data-status').textContent = `${store.data.indicators.length} sourced counters`;
}
function paint() {
  const seconds = clock.seconds(); const whole = Math.floor(seconds);
  const parts = [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60].map(x => String(x).padStart(2, '0'));
  $('timer').textContent = parts.join(':');
  $('timer').setAttribute('aria-label', `${Math.floor(whole / 3600)} hours, ${Math.floor(whole / 60) % 60} minutes, ${whole % 60} seconds`);
  for (const [id, node] of nodes) { const value = store.ledger.value(id, seconds); node.value.textContent = value === null ? 'Unavailable' : `\u2248 ${number.format(value)}`; node.gauge.update(value); }
  $('reset').disabled = !started;
}
function controls() {
  $('status').textContent = clock.running ? 'Running' : started ? 'Paused' : 'Ready';
  $('start').replaceChildren(document.createTextNode(clock.running ? 'Pause counter' : started ? 'Resume counter' : 'Start counter'), el('span', '', clock.running ? '\u2161' : '\u2197'));
  paint();
}
function freshness() {
  $('refresh-state').textContent = store.error ? `Check failed \u2014 ${store.data ? 'retaining last validated data (may be stale)' : 'data unavailable'}. ${store.error}` : 'Bundled dataset checked successfully';
  $('refresh-state').className = store.error ? 'error' : '';
  $('last-checked').textContent = `Last successful check: ${store.lastChecked ? store.lastChecked.toLocaleString() : 'not yet'}`;
  $('version').textContent = `Dataset version: ${store.data?.version || 'unavailable'} \u00b7 Research verified: ${store.data?.verified || 'unavailable'}`;
}
async function refresh() {
  if (refreshing) return;
  refreshing = true; lastAttempt = performance.now();
  $('refresh').disabled = true; $('refresh-state').textContent = 'Checking bundled dataset...';
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('./data/indicators.json', { cache:'no-store', signal:controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json(); const changed = !store.data || store.data.version !== data.version;
    store.accept(data, clock.seconds()); if (changed) renderIndicators();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([JSON.stringify(store.data, null, 2)], {type:'application/json'}));
    $('download').href = downloadUrl; $('download').removeAttribute('aria-disabled');
  } catch (error) {
    store.fail(error);
    if (!store.data) { $('data-status').textContent = 'Data unavailable'; empty('Source data could not be validated. The timer still works; estimates remain unavailable. Use Refresh now to retry.'); }
  } finally { clearTimeout(timeout); refreshing = false; $('refresh').disabled = false; freshness(); paint(); }
}
const noaa = initNoaa();
$('start').addEventListener('click', () => {
  if (clock.running) clock.pause(); else { clock.start(); if (!started) noaa.refresh(); started = true; }
  controls();
});
$('reset').addEventListener('click', () => {
  clock.reset(); started = false; store.ledger.reset(store.data?.indicators || []); controls();
  if (store.data) renderIndicators(); paint();
});
$('refresh').addEventListener('click', refresh); $('download').setAttribute('aria-disabled', 'true');
document.addEventListener('visibilitychange', () => { paint(); if (!document.hidden && performance.now() - lastAttempt >= POLL_MS) refresh(); });
setInterval(() => { if (clock.running) paint(); }, 1000);
setInterval(() => { if (performance.now() - lastAttempt >= POLL_MS) refresh(); }, POLL_MS);
refresh(); paint();
