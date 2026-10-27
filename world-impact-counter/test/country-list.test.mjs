import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rankCountries,countryListHtml} from '../src/country-list.mjs';
const metric='fossil-industrial-co2';
const country=(id,name,annualRate)=>({id,name,indicators:annualRate===undefined?[]:[{id:metric,annualRate,unit:'tonnes',ratePeriod:'2024 test fixture',qualityNote:'Test only'}]});
test('highest-first list sorts quantities numerically, includes genuine zero and separates missing values',()=>{
 const result=rankCountries([country('AAA','Two',2),country('BBB','Ten',10),country('CCC','Hundred',100),country('DDD','Zero',0),country('EEE','Missing'),country('FFF','Invalid string','1000')]);
 assert.deepEqual(result.available.map(row=>row.country.id),['CCC','BBB','AAA','DDD']);
 assert.deepEqual(result.missing.map(row=>row.country.id),['FFF','EEE']);
 assert.equal(result.available.at(-1).indicator.annualRate,0);
 const html=countryListHtml(result);assert.ok(html.indexOf('country-missing-heading')>html.indexOf('data-country-id="DDD"'));assert.match(html,/Unavailable/);
});
test('ties share quantity rank with deterministic alphabetical and ID ordering',()=>{
 const result=rankCountries([country('ZZZ','Beta',10),country('AAB','Alpha',10),country('AAA','Alpha',10),country('LOW','Low',2)]);
 assert.deepEqual(result.available.map(row=>row.country.id),['AAA','AAB','ZZZ','LOW']);
 assert.deepEqual(result.available.map(row=>row.rank),[1,1,1,4]);
});
test('list is populated without a search and optional filtering never manufactures data',()=>{
 const countries=[country('AUS','Australia',12),country('CAN','Canada',5)];
 assert.equal(rankCountries(countries).available.length,2);
 assert.deepEqual(rankCountries(countries,metric,'aus').available.map(row=>row.country.id),['AUS']);
 assert.equal(rankCountries(countries,metric,'zzzz').available.length,0);
 assert.throws(()=>rankCountries(countries,'overall-score'));
});
test('mixed-period and coverage limitations accompany selected metric ordering',async()=>{
 const data=JSON.parse(await readFile(new URL('../data/indicators.json',import.meta.url),'utf8'));
 const forest=rankCountries(data.countries,'gross-deforestation');
 assert.match(forest.note,/Mixed reference periods/);assert.match(forest.note,/not a same-year ranking/);assert.equal(forest.available.length,139);
 const food=rankCountries(data.countries,'food-waste');assert.equal(food.available.length,36);assert.match(food.note,/confidence/);
 assert.ok(food.missing.some(row=>row.country.id==='NLD'));assert.ok(food.missing.some(row=>row.country.id==='ESP'));
});
test('served HTML already contains every tappable country row in descending CO2 order, outside optional search',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const data=JSON.parse(await readFile(new URL('../data/indicators.json',import.meta.url),'utf8'));
 const result=rankCountries(data.countries);
 const block=html.split('<!-- COUNTRY_LIST_START -->')[1].split('<!-- COUNTRY_LIST_END -->')[0];
 assert.equal([...block.matchAll(/class="country-row"/g)].length,240);
 assert.equal([...block.matchAll(/data-annual-quantity=/g)].length,214);
 assert.equal([...block.matchAll(/data-country-id="([^"]+)"/g)][0][1],result.available[0].country.id);
 assert.ok(html.indexOf('id="country-list"')<html.indexOf('<details class="country-filter"'));
 assert.ok(!html.includes('<datalist'));
 assert.equal(block.trim(),countryListHtml(result));
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(css,/\.country-row\{[^}]*min-height:88px/);assert.match(css,/\.country-rank-list\{[^}]*overflow:auto/);
});
