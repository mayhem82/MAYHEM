import test from 'node:test';
import assert from 'node:assert/strict';
import { quantityGauge, isHttpsUrl, validIndicator } from '../src/engine.mjs';
import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile(new URL('../data/indicators.json',import.meta.url),'utf8'));
test('quantity gauge axes cover real amounts without a fixed severity ceiling',()=>{
  for (const value of [0,.001,.3,1,1.2,10,10.1,1208.14,1e9,Number.MAX_VALUE]) {
    const state=quantityGauge(value);
    assert.equal(state.value,value); assert.ok(state.maximum>=value); assert.ok(state.fraction>=0 && state.fraction<=1);
  }
  assert.equal(quantityGauge(1208).maximum,10000);
  assert.equal(quantityGauge(12080).maximum,100000);
  for (const value of [null,undefined,NaN,Infinity,-1]) assert.equal(quantityGauge(value),null);
});
test('source dates must be calendar dates and source links must be valid HTTPS URLs',()=>{
  const item=data.indicators[0]; assert.equal(validIndicator(item),true);
  for (const url of ['https://','javascript:alert(1)','http://example.org','//example.org']) {
    assert.equal(isHttpsUrl(url),false); assert.equal(validIndicator({...item,source:{...item.source,url}}),false);
  }
  for (const accessed of ['2026-99-99','2026-02-30','2026-1-2','']) assert.equal(validIndicator({...item,source:{...item.source,accessed}}),false);
});
