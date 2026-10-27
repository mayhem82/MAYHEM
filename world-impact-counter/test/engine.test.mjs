import test from 'node:test';
import assert from 'node:assert/strict';
import { ActiveClock, estimate, validIndicator, trendLabel, YEAR_SECONDS } from '../src/engine.mjs';
// Synthetic fixtures test arithmetic only; never included in shipped source data.
const fixture = { id:'fixture', name:'Test only', annualRate:YEAR_SECONDS, unit:'units', ratePeriod:'test period', source:{title:'Test fixture',url:'https://example.test',accessed:'2026-10-27'} };
test('repeated Start is idempotent', () => {
  let now = 100; const c = new ActiveClock(() => now); c.start(); now = 2100; c.start(); now = 3100;
  assert.equal(c.seconds(), 3);
});
test('pause excludes paused time and repeated pause is safe', () => {
  let now = 0; const c = new ActiveClock(() => now); c.start(); now = 1500; c.pause(); now = 10000; c.pause();
  assert.equal(c.seconds(), 1.5); c.start(); now = 10500; assert.equal(c.seconds(), 2);
});
test('reset stops and zeros both running and paused sessions', () => {
  let now = 0; const c = new ActiveClock(() => now); c.start(); now = 5000; c.reset();
  assert.equal(c.seconds(), 0); assert.equal(c.running, false); c.start(); now = 6000; c.pause(); c.reset(); assert.equal(c.seconds(), 0);
});
test('background gap counts accurately without any timer callback', () => {
  let now = 0; const c = new ActiveClock(() => now); c.start(); now = 6 * 3600 * 1000 + 123;
  assert.equal(c.seconds(), 21600.123); c.pause(); now += 99999; assert.equal(c.seconds(), 21600.123);
});
test('annual rate scales by exact active seconds', () => {
  assert.equal(estimate(fixture, 0), 0); assert.equal(estimate(fixture, 1.25), 1.25);
  assert.equal(estimate({...fixture, annualRate:50}, YEAR_SECONDS), 50);
});
test('missing and invalid inputs remain unavailable including missing source', () => {
  for (const item of [null, {}, {...fixture,annualRate:null}, {...fixture,annualRate:NaN}, {...fixture,annualRate:-1}, {...fixture,annualRate:Infinity}, {...fixture,source:null}, {...fixture,source:{...fixture.source,url:'javascript:alert(1)'}}, {...fixture,ratePeriod:''}]) {
    assert.equal(validIndicator(item), false); assert.equal(estimate(item, 10), null);
  }
  assert.equal(estimate(fixture, -1), null); assert.equal(estimate(fixture, NaN), null);
  assert.equal(estimate({...fixture,annualRate:0}, 100), 0);
});
test('trend requires independent evidence and supports either direction', () => {
  assert.equal(trendLabel(fixture), 'Trend unavailable');
  for (const direction of ['improving', 'worsening', 'mixed', 'stable']) {
    assert.equal(trendLabel({...fixture,trend:{direction,period:'test',note:'test',sourceUrl:'https://example.test'}}).toLowerCase(), direction);
  }
  assert.equal(trendLabel({...fixture,trend:{direction:'worsening'}}), 'Trend unavailable');
});
