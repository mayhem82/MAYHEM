import test from 'node:test';
import assert from 'node:assert/strict';
import {initNoaa} from '../src/noaa.mjs';
import {NOAA_URL} from '../src/noaa-parser.mjs';

test('NOAA production fetch controller retains UI/cache on failure and recovers (DOM simulation, not browser CORS)',async()=>{
  const originals={document:globalThis.document,localStorage:globalThis.localStorage,fetch:globalThis.fetch,setInterval:globalThis.setInterval};
  const elements=new Map();const storage=new Map();const intervals=[];const calls=[];
  const csv='year,month,day,smoothed,trend\n2026,10,25,426.89,428.10\n';
  let outcome='success';
  globalThis.document={hidden:false,getElementById(id){if(!elements.has(id))elements.set(id,{textContent:'',disabled:false,className:'',addEventListener(){}});return elements.get(id);},addEventListener(){}};
  globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  globalThis.setInterval=(callback,ms)=>{intervals.push({callback,ms});return intervals.length;};
  globalThis.fetch=async(url,options)=>{
    calls.push({url,options});
    if(outcome==='offline')throw new TypeError('simulated offline');
    return {ok:true,status:200,text:async()=>outcome==='invalid'?'wrong,schema':csv};
  };
  try{
    const controller=initNoaa();
    assert.equal(elements.get('noaa-value').textContent,'Unavailable');
    assert.equal(calls.length,0);
    await controller.refresh();
    assert.equal(elements.get('noaa-value').textContent,'428.10 ppm');
    assert.equal(calls[0].url,NOAA_URL);assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.mode,'cors');
    const cached=storage.get('world-impact-noaa-v1');const checked=elements.get('noaa-checked').textContent;
    for(const failure of ['offline','invalid']){
      outcome=failure;await controller.refresh();
      assert.equal(elements.get('noaa-value').textContent,'428.10 ppm');
      assert.equal(elements.get('noaa-date').textContent,'Data date: 2026-10-25');
      assert.equal(elements.get('noaa-checked').textContent,checked);assert.equal(storage.get('world-impact-noaa-v1'),cached);
      assert.match(elements.get('noaa-state').textContent,/Check failed/);assert.equal(elements.get('noaa-refresh').disabled,false);
    }
    outcome='success';await controller.refresh();assert.match(elements.get('noaa-state').textContent,/checked successfully/);
    assert.equal(intervals[0].ms,3600000);
  }finally{Object.assign(globalThis,originals);}
});
