import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ActiveClock,YEAR_SECONDS,validateDataset,geographies,geographyKey,datasetRates} from '../src/engine.mjs';
import {DatasetStore} from '../src/data-store.mjs';
const source=JSON.parse(await readFile(new URL('../data/indicators.json',import.meta.url),'utf8'));
// Synthetic arithmetic fixture; not published as country data.
const fixture={...source.indicators[0],id:'test-flow',annualRate:YEAR_SECONDS};
const data={...source,indicators:[fixture],countries:[{id:'AUS',name:'Australia',indicators:[{...fixture,annualRate:2*YEAR_SECONDS}]},{id:'CAN',name:'Canada',indicators:[]}]};
test('country coverage is explicit and missing countries never inherit world rates',()=>{
 assert.equal(validateDataset(data),data);
 assert.deepEqual(geographies(data).map(g=>g.id),['WORLD','AUS','CAN']);
 assert.deepEqual(geographies(data).find(g=>g.id==='CAN').indicators,[]);
 assert.equal(geographies(data).find(g=>g.id==='NZL'),undefined);
 assert.equal(datasetRates(data).length,2);
});
test('country ledgers share elapsed active time but never share amounts or reset on selection',()=>{
 let now=0;const clock=new ActiveClock(()=>now);const store=new DatasetStore();store.accept(data,0);clock.start();now=10000;
 const world=()=>store.ledger.value(geographyKey('WORLD',fixture.id),clock.seconds());
 const aus=()=>store.ledger.value(geographyKey('AUS',fixture.id),clock.seconds());
 assert.equal(world(),10);assert.equal(aus(),20);assert.equal(world(),10);
 clock.pause();now=20000;assert.equal(aus(),20);clock.start();now=25000;assert.equal(world(),15);assert.equal(aus(),30);
 assert.equal(store.ledger.value(geographyKey('CAN',fixture.id),clock.seconds()),null);
 clock.reset();store.ledger.reset(datasetRates(data));assert.equal(world(),0);assert.equal(aus(),0);
});
test('new country rates start prospectively and changes preserve each country history',()=>{
 const store=new DatasetStore();store.accept({...data,countries:[]},0);
 store.accept({...data,version:'country-added'},10);
 assert.equal(store.ledger.value(geographyKey('AUS',fixture.id),15),10);
 assert.equal(store.ledger.value(fixture.id,15),15);
 store.accept({...data,version:'country-rate-change',countries:[{...data.countries[0],indicators:[{...fixture,annualRate:3*YEAR_SECONDS}]}]},15);
 assert.equal(store.ledger.value(geographyKey('AUS',fixture.id),20),25);
 assert.equal(store.ledger.value(fixture.id,20),20);
});
test('invalid and duplicate country inputs are rejected without corrupting validated data',()=>{
 const store=new DatasetStore();store.accept(data,0);
 for(const countries of [[data.countries[0],data.countries[0]],[{id:'AU',name:'Australia',indicators:[]}],[{...data.countries[0],indicators:[{...fixture,annualRate:null}]}]]){
  assert.throws(()=>store.accept({...data,version:'invalid',countries},5));assert.equal(store.data,data);
 }
});
