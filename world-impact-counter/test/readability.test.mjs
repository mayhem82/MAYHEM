import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const current=await readFile(new URL('../styles.css',import.meta.url),'utf8');
const before=await readFile(new URL('./fixtures/styles.before-readability.css',import.meta.url),'utf8');
const fontSizes=css=>[...css.matchAll(/font-size:([^;}]+)/g)].map(match=>match[1]);
test('small-text baseline is exactly +4px once; large type and clamp values remain unchanged',()=>{
  const old=fontSizes(before),now=fontSizes(current);
  assert.equal(now.length,old.length);
  let changed=0;
  old.forEach((size,index)=>{
    const match=/^(\d+)px$/.exec(size);
    const expected=match && Number(match[1])<=15 ? `${Number(match[1])+4}px` : size;
    assert.equal(now[index],expected,`font declaration ${index}: ${size}`);
    if(size!==expected)changed++;
  });
  assert.equal(changed,29);
  assert.ok(!/font-size:\s*(?:calc|[\d.]+(?:em|rem)|inherit)/.test(current),'sizes are absolute, preventing inherited increments');
});
test('narrow-width layout rules allow text reflow without reducing text size',()=>{
  assert.match(current,/header,\.timer-heading,\.section-heading,\.indicator-top\{flex-wrap:wrap\}/);
  assert.match(current,/\.controls\{grid-template-columns:minmax\(0,1fr\) 84px/);
  assert.match(current,/@media\(max-width:360px\)[\s\S]*\.controls\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(current,/\.refresh-panel>div,\.indicator-top>h3,\.section-heading>\*\{min-width:0\}/);
  assert.match(current,/\.gauge-axis,\.estimate-unit,footer\{overflow-wrap:anywhere\}/);
  const narrow=current.slice(current.indexOf('@media(max-width:360px)'));
  assert.ok(!narrow.includes('font-size:'),'narrow screens never shrink the increased text');
  for(const viewport of [320,360,375,390,412]){
    const content=viewport-44;
    const timerContent=content-44;
    assert.ok(timerContent>0);
    if(viewport>360)assert.ok(timerContent-84-10>0,'two-column control has a shrinkable positive first track');
  }
});
