import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ActiveClock, RateLedger, YEAR_SECONDS, validateDataset } from '../src/engine.mjs';
import { DatasetStore } from '../src/data-store.mjs';
import { parseNoaa, ObservationStore } from '../src/noaa-parser.mjs';
const data = JSON.parse(await readFile(new URL('../data/indicators.json', import.meta.url), 'utf8'));
const fixture = { ...data.indicators[0], annualRate:YEAR_SECONDS };
const dataset = { ...data, indicators:[fixture] };
const csv = '# source comment\nyear,month,day,smoothed,trend\n2026,10,25,426.89,428.10\n';
test('bundled rates are complete and match supplied research', () => {
  assert.equal(validateDataset(data).indicators.length, 3);
  assert.deepEqual(data.indicators.map(i=>i.annualRate), [38100000000,10900000,1050000000]);
  assert.equal(YEAR_SECONDS,31536000);
});
test('rate changes apply prospectively and preserve accrued totals', () => {
  const l = new RateLedger(); l.update([fixture], 0); assert.equal(l.value(fixture.id,10),10);
  l.update([{...fixture,annualRate:2*YEAR_SECONDS}],10); assert.equal(l.value(fixture.id,10),10); assert.equal(l.value(fixture.id,20),30);
});
test('unchanged refresh does not reset accumulation; reset does', () => {
  const l = new RateLedger(); l.update([fixture],0); l.update([fixture],7); assert.equal(l.value(fixture.id,10),10);
  l.reset([fixture]); assert.equal(l.value(fixture.id,0),0);
});
test('paused refresh changes future resumed rate without accumulating pause or rewriting history', () => {
  let now = 0; const c = new ActiveClock(()=>now); const l = new RateLedger(); l.update([fixture],0);
  c.start(); now = 10000; c.pause(); assert.equal(l.value(fixture.id,c.seconds()),10);
  now = 100000; l.update([{...fixture,annualRate:2*YEAR_SECONDS}],c.seconds());
  assert.equal(l.value(fixture.id,c.seconds()),10); c.start(); now += 5000;
  assert.equal(l.value(fixture.id,c.seconds()),20);
});
test('missing rate does not retroactively accrue; unavailable intervals excluded', () => {
  const l = new RateLedger(); l.update([],0); assert.equal(l.value(fixture.id,20),null);
  l.update([fixture],20); assert.equal(l.value(fixture.id,25),5); l.update([],25); assert.equal(l.value(fixture.id,40),null);
  l.update([fixture],40); assert.equal(l.value(fixture.id,45),10);
});
test('failed or invalid refresh retains validated data, timestamp and accrual', () => {
  const s = new DatasetStore(); const first = new Date('2026-10-27T00:00:00Z'); s.accept(dataset,0,first);
  s.fail(new Error('offline')); assert.equal(s.data,dataset); assert.equal(s.lastChecked,first); assert.equal(s.ledger.value(fixture.id,10),10);
  assert.throws(()=>s.accept({...dataset,indicators:[{}]},10)); assert.equal(s.data,dataset); assert.equal(s.lastChecked,first);
  const next = new Date('2026-10-27T00:01:00Z'); s.accept(dataset,10,next); assert.equal(s.error,null); assert.equal(s.lastChecked,next); assert.equal(s.ledger.value(fixture.id,15),15);
});
test('versioning and unit changes are rejected without rewriting ledger', () => {
  const s = new DatasetStore(); s.accept(dataset,0);
  assert.throws(()=>s.accept({...dataset,indicators:[{...fixture,annualRate:4}]},10));
  assert.throws(()=>s.accept({...dataset,version:'new',indicators:[{...fixture,unit:'different'}]},10));
  assert.equal(s.ledger.value(fixture.id,20),20);
});
test('empty input stays valid but unavailable', () => { assert.deepEqual(validateDataset({...data,indicators:[]}).indicators,[]); });
test('NOAA CSV validates schema and extracts dated seasonally adjusted trend', () => {
  assert.deepEqual(parseNoaa(csv,new Date('2026-10-27')), {date:'2026-10-25',smoothed:426.89,trend:428.10});
  assert.equal(parseNoaa(csv+'2026,10,26,-999.99,-999.99\n',new Date('2026-10-27')).date,'2026-10-25');
  for (const bad of ['<html>oops</html>',csv.replace('trend','other'),csv.replace('426.89',''),csv.replace('426.89','0'),csv.replace('10,25','2,30'),csv.replace('426.89','NaN')]) assert.throws(()=>parseNoaa(bad,new Date('2026-10-27')));
});
test('NOAA failure retains dated snapshot and recovers; unchanged checks update fetch time only', () => {
  const s = new ObservationStore(); s.accept(csv,new Date('2026-10-27T00:00:00Z')); const snapshot = s.snapshot;
  s.fail(new Error('CORS/network failure')); assert.equal(s.snapshot,snapshot); assert.equal(s.lastChecked,'2026-10-27T00:00:00.000Z');
  assert.throws(()=>s.accept('invalid')); assert.equal(s.snapshot,snapshot);
  s.accept(csv,new Date('2026-10-27T01:00:00Z')); assert.equal(s.error,null); assert.equal(s.snapshot.date,'2026-10-25'); assert.equal(s.lastChecked,'2026-10-27T01:00:00.000Z');
});
