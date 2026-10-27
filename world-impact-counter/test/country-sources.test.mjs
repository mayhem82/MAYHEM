import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateDataset} from '../src/engine.mjs';
import {parseCsv,spreadsheetRows} from '../tools/source-parsers.mjs';
const data=JSON.parse(await readFile(new URL('../data/indicators.json',import.meta.url),'utf8'));
const manifest=JSON.parse(await readFile(new URL('../data/source-manifest.json',import.meta.url),'utf8'));
test('published country coverage matches audited source records, with no regional aggregates',()=>{
 assert.equal(validateDataset(data),data);assert.equal(data.countries.length,240);
 const count=id=>data.countries.filter(country=>country.indicators.some(item=>item.id===id)).length;
 assert.equal(count('fossil-industrial-co2'),214);assert.equal(count('gross-deforestation'),139);assert.equal(count('food-waste'),36);
 assert.deepEqual(manifest.coverage.forestFlags,{A:124,I:15});
 assert.ok(data.countries.every(country=>!['World','OECD','EU27','International Shipping','International Aviation'].includes(country.name)));
 assert.ok(Math.abs(manifest.sources.find(source=>source.id==='gcb-country').balanceCheck.residualMtC)<1e-7);
});
test('Australia retains actual separate rates, dates, units, matched sectors and expansion context',()=>{
 const country=data.countries.find(item=>item.id==='AUS');
 const co2=country.indicators.find(item=>item.id==='fossil-industrial-co2');
 const forest=country.indicators.find(item=>item.id==='gross-deforestation');
 const food=country.indicators.find(item=>item.id==='food-waste');
 assert.ok(Math.abs(co2.annualRate-386732383.4769822)<1e-6);assert.equal(co2.source.cell,'L187');assert.equal(co2.source.version,'v0.3');assert.match(co2.ratePeriod,/2024/);
 assert.equal(forest.annualRate,447460);assert.equal(forest.source.referenceInterval,'2015-2020');assert.equal(forest.source.flag,'A');
 assert.equal(country.sourceEvidence.forest.find(row=>row.period==='2020-2025').grossDeforestationThousandHectares,null);
 assert.equal(country.observations[0].value,604180);assert.equal(country.observations[0].referencePeriod,'2015-2020');
 assert.ok(Math.abs(food.annualRate-4630767.2048)<1e-8);assert.deepEqual(food.source.components.map(item=>item.sector).sort(),['HHS','OOHC','RTL']);
 assert.ok(food.source.components.every(item=>item.confidence.includes('High Confidence')));
});
test('food ALL totals and definition-differs components never become comparable country gauges',()=>{
 for(const country of data.countries){
  const food=country.indicators.find(item=>item.id==='food-waste');if(!food)continue;
  assert.equal(food.source.components.length,3);
  assert.ok(food.source.components.every(item=>item.sector!=='ALL'&&item.attributes['Observation Status']!=='D'));
  assert.ok(Math.abs(food.source.components.reduce((sum,item)=>sum+item.tonnes,0)-food.annualRate)<1e-6);
 }
 for(const id of ['NLD','ESP']){
  const country=data.countries.find(item=>item.id===id);
  assert.ok(!country.indicators.some(item=>item.id==='food-waste'));
  assert.match(country.unavailableMetrics.find(item=>item.name.includes('food')).reason,/Definition differs/);
  assert.ok(country.sourceEvidence.food2022.some(item=>item.attributes['Observation Status']==='D'));
 }
});
test('missing forest values stay missing and imputed flags remain visible',()=>{
 const imputed=data.countries.flatMap(country=>country.indicators).filter(item=>item.id==='gross-deforestation'&&item.source.flag==='I');
 assert.equal(imputed.length,15);assert.ok(imputed.every(item=>/imputed/i.test(item.qualityNote)));
 const zero=data.countries.flatMap(country=>country.indicators).find(item=>item.id==='gross-deforestation'&&item.annualRate===0);
 assert.ok(zero,'genuine reported zero remains available');
 assert.ok(data.countries.some(country=>country.unavailableMetrics.some(item=>item.name==='Gross deforestation')));
});
test('source parsers preserve quoted CSV cells and spreadsheet blank-cell alignment',()=>{
 assert.deepEqual(parseCsv('name,value\n"Bonaire, Sint Eustatius",0\nBlank,\n'),[{name:'Bonaire, Sint Eustatius',value:'0'},{name:'Blank',value:''}]);
 const rows=spreadsheetRows('<sst><si><t>Afghanistan</t></si><si><t>Australia</t></si></sst>','<row r="12"><c r="A12"/><c r="B12" t="s"><v>0</v></c><c r="L12" t="s"><v>1</v></c></row>');
 assert.equal(rows.get(12).B,'Afghanistan');assert.equal(rows.get(12).L,'Australia');assert.equal(rows.get(12).A,undefined);
});
