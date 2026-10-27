import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {YEAR_SECONDS} from '../src/engine.mjs';

// Production event handlers with a minimal simulated DOM. This is not browser QA.
test('country controls preserve active time, pause state, independent totals and global-only NOAA',async()=>{
 const originals=Object.fromEntries(['document','localStorage','fetch','setInterval','performance'].map(key=>[key,globalThis[key]]));
 class Node {
  constructor(tag='div'){this.tag=tag;this.children=[];this.attrs={};this.listeners={};this.value='';this.hidden=false;this._text='';this.className='';}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  append(...nodes){for(const node of nodes)node.parentElement=this;this.children.push(...nodes);}
  replaceChildren(...nodes){this._text='';for(const node of nodes)node.parentElement=this;this.children=nodes;}
  setAttribute(key,value){this.attrs[key]=String(value);}
  removeAttribute(key){delete this.attrs[key];}
  getAttribute(key){return this.attrs[key]??null;}
  closest(){return this.attrs['data-country-id']?this:this.parentElement?.closest();}
  addEventListener(type,callback){this.listeners[type]=callback;}
  fire(type,target=this){return this.listeners[type]?.({target});}
 }
 const elements=new Map();const intervals=[];let now=0;let noaaRequests=0;
 const $=id=>{if(!elements.has(id))elements.set(id,new Node());return elements.get(id);};
 const source=JSON.parse(await readFile(new URL('../data/indicators.json',import.meta.url),'utf8'));
 const fixture={...source.indicators[0],id:'fossil-industrial-co2',annualRate:YEAR_SECONDS};
 const data={...source,indicators:[fixture],countries:[{id:'AUS',name:'Australia',indicators:[{...fixture,annualRate:2*YEAR_SECONDS}]},{id:'CAN',name:'Canada',indicators:[]}]};
 const storage=new Map();
 globalThis.document={hidden:false,getElementById:$,createElement:tag=>new Node(tag),createElementNS:(_ns,tag)=>new Node(tag),createTextNode:text=>{const node=new Node('text');node.textContent=text;return node;},addEventListener(){}};
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
 globalThis.setInterval=(callback,ms)=>{intervals.push({callback,ms});return intervals.length;};
 globalThis.performance={now:()=>now};
 globalThis.fetch=async url=>{
  if(String(url).includes('indicators.json'))return {ok:true,json:async()=>data};
  noaaRequests++;return {ok:true,text:async()=>'year,month,day,smoothed,trend\n2026,10,25,426.89,428.10\n'};
 };
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 const tick=()=>intervals.find(item=>item.ms===1000).callback();
 const estimate=()=>{
  function find(node){if(node.className==='estimate')return node.textContent;for(const child of node.children){const result=find(child);if(result)return result;}}
  return find($('indicators'));
 };
 const countryButton=id=>{
  function find(node){if(node.getAttribute('data-country-id')===id)return node;for(const child of node.children){const result=find(child);if(result)return result;}}
  return find($('country-list'));
 };
 try{
  await import(`../src/app.mjs?country-controls-test=${Date.now()}`);await flush();
  assert.equal($('geography').value,'WORLD');assert.equal($('noaa-panel').hidden,false);
  assert.equal($('country-search').value,'');assert.ok(countryButton('AUS'));assert.ok(countryButton('CAN'));
  $('country-list').fire('click',countryButton('AUS').children[0]);assert.equal($('geography').value,'AUS');assert.equal($('timer').textContent,'00:00:00');assert.equal(noaaRequests,0);
  assert.equal($('selected-geography').textContent,'Selected geography: Australia');$('choose-world').fire('click');
  $('start').fire('click');await flush();now=10000;tick();assert.equal(estimate(),'≈ 10');assert.equal(noaaRequests,1);
  $('country-list').fire('click',countryButton('AUS'));assert.equal($('timer').textContent,'00:00:10');assert.equal(estimate(),'≈ 20');assert.equal($('noaa-panel').hidden,true);assert.equal($('status').textContent,'Running');
  now=15000;tick();assert.equal(estimate(),'≈ 30');$('choose-world').fire('click');assert.equal(estimate(),'≈ 15');
  $('start').fire('click');now=40000;$('choose-australia').fire('click');assert.equal(estimate(),'≈ 30');assert.equal($('status').textContent,'Paused');
  $('country-metric').value='gross-deforestation';$('country-metric').fire('change');assert.match($('country-rank-note').textContent,/not a same-year ranking/);assert.equal(estimate(),'≈ 30');assert.equal($('status').textContent,'Paused');
  $('start').fire('click');now=45000;tick();assert.equal(estimate(),'≈ 40');
  $('country-list').fire('click',countryButton('CAN'));assert.match($('indicators').textContent,/No verified ticking rates are available for Canada/);assert.ok(!$('indicators').textContent.includes('≈ 0'));
  $('reset').fire('click');$('choose-world').fire('click');assert.equal(estimate(),'≈ 0');assert.equal($('timer').textContent,'00:00:00');assert.equal($('status').textContent,'Ready');
  $('country-search').value='zzzz';$('country-search').fire('input');assert.deepEqual($('geography').children.map(option=>option.value),['WORLD','AUS']);
 }finally{Object.assign(globalThis,originals);}
});
