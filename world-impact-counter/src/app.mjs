import { ActiveClock, YEAR_SECONDS, trendLabel, isHttpsUrl, geographies, geographyKey, datasetRates } from './engine.mjs';
import { DatasetStore } from './data-store.mjs';
import { initNoaa } from './noaa.mjs';
import { createQuantityGauge } from './gauge.mjs';
import { rankCountries, renderCountryList } from './country-list.mjs';

const clock = new ActiveClock();
const store = new DatasetStore();
const $ = id => document.getElementById(id);
const POLL_MS = 5 * 60 * 1000;
let lastAttempt = -Infinity;
let refreshing = false;
let started = false;
let downloadUrl;
let selectedGeography = 'WORLD';
let selectedName = 'World';
let noaaActivated = false;
let pendingGeography = null;
const nodes = new Map();
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });
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
  const geography = geographies(store.data).find(item=>item.id===selectedGeography) || {id:selectedGeography,name:selectedName,indicators:[]};
  selectedName = geography.name;
  $('selected-geography').textContent = `Selected geography: ${geography.name}`;
  $('indicator-title').textContent = selectedGeography === 'WORLD' ? 'During your moment' : `${geography.name} during your moment`;
  $('geography-note').textContent = 'Switching views keeps the same active time. Each available rate estimates only the selected geography; missing data is never zero.';
  $('noaa-panel').hidden = selectedGeography !== 'WORLD';
  for (const item of geography.indicators) {
    const ledgerId = geographyKey(geography.id,item.id);
    const card = el('article', `indicator ${item.id}`);
    const top = el('div', 'indicator-top');
    const label = trendLabel(item);
    top.append(el('h3', '', item.name), el('span', `trend ${item.trend?.direction || ''}`, label));
    const value = el('div', 'estimate', 'Unavailable');
    const gauge = createQuantityGauge(item.unit);
    card.append(top, gauge.element, value, el('div', 'estimate-unit', `${item.unit} \u00b7 estimated for ${geography.name} since Start`));
    card.append(el('p', 'gauge-note', 'Auto-scaled quantity axis. Position is not severity or trend.'));
    card.append(el('p', 'reference-period', `Data period: ${item.ratePeriod}`));
    if (store.ledger.entries.get(ledgerId).firstAvailable > 0) card.append(el('p', '', 'Excludes active time before this rate became available.'));
    if (geography.id !== 'WORLD' && item.scope) card.append(el('p', 'scope-note', `Scope: ${item.scope}`));
    if (item.qualityNote) card.append(el('p', '', item.qualityNote));
    const details = el('details');
    details.append(el('summary', '', 'Source & assumptions'), el('p', '', `Current annual rate: ${number.format(item.annualRate)} ${item.unit} (${number.format(item.annualRate / YEAR_SECONDS)}/second)`));
    details.append(link(item.source.title, item.source.url), el('p', '', `Published ${item.source.published || 'not specified'} \u00b7 Verified ${item.source.accessed}`));
    if (item.scope) details.append(el('p', '', `Coverage: ${item.scope}`));
    details.append(el('p', '', item.limitations || 'Constant-rate approximation; actual events vary over time.'));
    if (item.trend?.note && isHttpsUrl(item.trend.sourceUrl)) details.append(el('p', '', `Trend (${item.trend.period}): ${item.trend.note}`), link('Trend source', item.trend.sourceUrl));
    card.append(details); nodes.set(ledgerId, {value,gauge}); $('indicators').append(card);
  }
  if (!geography.indicators.length) empty(`No verified ticking rates are available for ${geography.name}. The active timer continues. No values are borrowed from world totals.`);
  for (const missing of geography.unavailableMetrics || []) {
    const card=el('article','indicator unavailable');
    card.append(el('h3','',missing.name),el('div','estimate','Unavailable'),el('p','',missing.reason));
    $('indicators').append(card);
  }
  for (const observation of geography.observations || []) {
    const card=el('article','indicator reported-context');
    card.append(el('p','eyebrow','REPORTED CONTEXT · DOES NOT TICK'),el('h3','',observation.name),el('div','estimate',`${number.format(observation.value)} ${observation.unit}`),el('p','',`Reference period: ${observation.referencePeriod}`),el('p','',observation.scope || ''),link(observation.source.title || 'Official source',observation.source.url),el('p','',`Verified ${observation.source.accessed}`),el('p','',observation.limitations || ''));
    $('indicators').append(card);
  }
  $('coverage-notes').replaceChildren(...(geography.coverageNotes || []).map(note=>el('p','',note)));
  $('data-status').textContent = `${geography.indicators.length} sourced estimate${geography.indicators.length===1?'':'s'}`;
}
function renderCountryOptions() {
  if(!store.data){$('country-list-status').textContent='Loading validated source data. The visible list is the bundled CO2 snapshot; a country tap will be applied when loading finishes.';return;}
  const query=$('country-search').value.trim().toLocaleLowerCase();
  const available=geographies(store.data);
  const filtered=available.filter(item=>item.id==='WORLD' || item.id==='AUS' || item.id===selectedGeography || `${item.name} ${item.id} ${(item.searchAliases||[]).join(' ')}`.toLocaleLowerCase().includes(query));
  if (!filtered.some(item=>item.id===selectedGeography)) filtered.push({id:selectedGeography,name:selectedName,indicators:[]});
  $('geography').replaceChildren(...filtered.map(item=>{
    const option=el('option','',`${item.name}${item.indicators.length?'':' — no ticking data'}`);option.value=item.id;return option;
  }));
  $('geography').value=selectedGeography;
  $('country-results').textContent=`${available.filter(item=>item.id!=='WORLD').length} countries in the source file. Search filters this list; World and Australia stay easy to find.`;
  const ranked=rankCountries(store.data?.countries,$('country-metric').value||'fossil-industrial-co2',query);
  $('country-rank-title').textContent=ranked.title;
  $('country-rank-note').textContent=ranked.note;
  $('country-list-status').textContent=`${ranked.available.length} available · ${ranked.missing.length} unavailable/non-comparable. Highest reported annual quantities first. Scroll the list and tap a country to view its gauges.`;
  renderCountryList($('country-list'),ranked,selectedGeography);
}
function chooseGeography(id,name) {
  if(!store.data){pendingGeography={id,name};$('selected-geography').textContent=`Loading source data for ${name||id}…`;return;}
  const found=geographies(store.data).find(item=>item.id===id);
  if (!found) return;
  selectedGeography=id; selectedName=found.name; renderCountryOptions(); renderIndicators(); paint();
  if (id==='WORLD' && started && !noaaActivated) { noaaActivated=true; noaa.refresh(); }
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
    store.accept(data, clock.seconds());
    $('country-metric').disabled=false;
    if(pendingGeography){const found=geographies(data).find(item=>item.id===pendingGeography.id);if(found){selectedGeography=found.id;selectedName=found.name;}pendingGeography=null;}
    if (changed) {renderCountryOptions();renderIndicators();}
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
  if (clock.running) clock.pause(); else { clock.start(); if (!started && selectedGeography==='WORLD') {noaaActivated=true;noaa.refresh();} started = true; }
  controls();
});
$('reset').addEventListener('click', () => {
  clock.reset(); started = false; store.ledger.reset(datasetRates(store.data)); controls();
  if (store.data) renderIndicators(); paint();
});
$('refresh').addEventListener('click', refresh); $('download').setAttribute('aria-disabled', 'true');
$('geography').addEventListener('change',event=>chooseGeography(event.target.value));
$('country-search').addEventListener('input',renderCountryOptions);
$('country-metric').addEventListener('change',renderCountryOptions);
$('country-list').addEventListener('click',event=>{
  const button=event.target.closest?.('[data-country-id]');
  if(!button)return;
  chooseGeography(button.getAttribute('data-country-id'),button.getAttribute('data-country-name'));
  if(store.data)$('timer-section').scrollIntoView?.({block:'start',behavior:'auto'});
});
$('choose-world').addEventListener('click',()=>chooseGeography('WORLD','World'));
$('choose-australia').addEventListener('click',()=>chooseGeography('AUS','Australia'));
document.addEventListener('visibilitychange', () => { paint(); if (!document.hidden && performance.now() - lastAttempt >= POLL_MS) refresh(); });
setInterval(() => { if (clock.running) paint(); }, 1000);
setInterval(() => { if (performance.now() - lastAttempt >= POLL_MS) refresh(); }, POLL_MS);
refresh(); paint();
