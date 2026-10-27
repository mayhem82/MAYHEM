// Offline normalization of the independently downloaded public source files.
// Usage: node tools/build-country-data.mjs <source-directory>
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseCsv,spreadsheetRows,nameKey} from './source-parsers.mjs';
import {validateDataset} from '../src/engine.mjs';
const directory=process.argv[2];if(!directory)throw new Error('Supply the directory containing the source files; this script never accepts licences or fetches gated sources.');
const read=name=>readFile(path.join(directory,name),'utf8');
const date='2026-10-27';
const root=JSON.parse(await readFile(new URL('../data/indicators.json',import.meta.url),'utf8'));
const intervals=parseCsv(await read('fao-intervals.csv'));
const forestRows=parseCsv(await read('fao-deforestation.csv'));
const un=JSON.parse(await read('un-food-waste.json'));
const workbook=spreadsheetRows(await read('sharedStrings.xml'),await read('sheet2.xml'));
const aliases={'Bonaire, Saint Eustatius and Saba':'BES','Cape Verde':'CPV','North Korea':'PRK','Faeroe Islands':'FRO','Iran':'IRN','Laos':'LAO','Nauru':'NRU','Netherlands':'NLD','State of Palestine':'PSE','Bolivia':'BOL','South Korea':'KOR','Moldova':'MDA','Russia':'RUS','Saint Helena':'SHN','Syria':'SYR','United Kingdom':'GBR','Tanzania':'TZA','USA':'USA','Venezuela':'VEN'};
const extra=[{id:'HKG',name:'Hong Kong',m49:'344'},{id:'MAC',name:'Macao',m49:'446'},{id:'TWN',name:'Taiwan',m49:'158'},{id:'XKX',name:'Kosovo',m49:null}];
const countries=forestRows.map(row=>({id:row.iso3,name:row.name,m49:row.m49,sourceNames:{FAO:row.name},indicators:[],observations:[],coverageNotes:[],unavailableMetrics:[],sourceEvidence:{}}));
countries.push(...extra.map(item=>({...item,sourceNames:{GCB:item.name},indicators:[],observations:[],coverageNotes:[],unavailableMetrics:[],sourceEvidence:{}})));
const byId=new Map(countries.map(country=>[country.id,country]));
const byName=new Map(countries.map(country=>[nameKey(country.name),country]));
const faoUrl='https://fra-data.fao.org/';
const gcbUrl='https://globalcarbonbudget.org/datahub/the-latest-gcb-data-2025/';
const foodUrl='https://unstats.un.org/sdgapi/v1/sdg/Series/Data?seriesCode=AG_FOOD_WST&pageSize=10000';
const source=(title,url,fields={})=>({title,url,accessed:date,...fields});
const co2Columns=Object.entries(workbook.get(12)).slice(0,214);
if(co2Columns.length!==214 || workbook.get(187).A!=='2024')throw new Error('Unexpected GCB header or year');
let countryMtC=0;
for(const [column,name] of co2Columns){
 const country=byId.get(aliases[name]) || byName.get(nameKey(name));
 if(!country)throw new Error(`Unmapped GCB country: ${name}`);
 const raw=workbook.get(187)[column];
 if(raw===undefined||raw===''||!Number.isFinite(Number(raw))||Number(raw)<0)throw new Error(`Missing GCB country value: ${name}`);
 const mtc=Number(raw);countryMtC+=mtc;
 country.sourceNames.GCB=name;
 country.searchAliases=[...new Set([...(country.searchAliases||[]),name])];
 const previous=Number(workbook.get(186)[column]);
 const trend=Number.isFinite(previous)&&previous>=0?{direction:mtc===previous?'stable':mtc<previous?'improving':'worsening',period:'2024 versus 2023, GCB v0.3',note:`Calculated from the same territorial series: ${previous===0?'absolute annual comparison':`${((mtc/previous-1)*100).toFixed(1)}% annual change`}. This describes fossil CO2 emissions only, not an overall country rating.`,sourceUrl:gcbUrl}:undefined;
 country.indicators.push({id:'fossil-industrial-co2',name:'Territorial fossil CO2 emitted',annualRate:mtc*3.664*1e6,unit:'metric tonnes of CO2',ratePeriod:'2024 annual estimate · GCB 2025 v0.3',scope:'Territorial fossil-fuel combustion/oxidation and cement production; excludes international aviation/shipping bunkers. Publisher geographic definitions apply.',source:source('Global Carbon Budget 2025 country workbook — public v0.3',gcbUrl,{version:'v0.3',workbook:'National_Fossil_Carbon_Emissions_2025_v0.3.xlsx',sheet:'Territorial Emissions',cell:`${column}187`,sourceCountryName:name,rawValue:mtc,rawUnit:'million tonnes carbon/year',conversionToTonnesCO2:3664000,previousYearRawValueMtC:Number.isFinite(previous)?previous:null}),trend,limitations:'Public workbook v0.3, not the final v1.0 release. 2024 country data is not the 2025 world projection. Multiply MtC by 3.664 million for tonnes CO2. National territories exclude international bunkers; country totals are not forced to equal the world baseline. Uniform-rate estimate, not live events.'});
}
const workbookWorld=Number(workbook.get(187).HX),bunkers=Number(workbook.get(187).HU)+Number(workbook.get(187).HV);
if(Math.abs(countryMtC+bunkers-workbookWorld)>1e-7)throw new Error('GCB country/bunker/world balance failed');
const periods=['2020-2025','2015-2020','2010-2015','2000-2010','1990-2000'];
for(const country of countries){
 const rows=intervals.filter(row=>row.iso3===country.id);
 const available=periods.map(period=>rows.find(row=>row.year===period)).find(row=>row&&row['1d_deforestation'].trim()!==''&&['A','I'].includes(row['1d_deforestation_flag'])&&Number.isFinite(Number(row['1d_deforestation']))&&Number(row['1d_deforestation'])>=0);
 country.sourceEvidence.forest=rows.map(row=>({period:row.year,grossDeforestationThousandHectares:row['1d_deforestation']===''?null:Number(row['1d_deforestation']),deforestationFlag:row['1d_deforestation_flag'],expansionThousandHectares:row['1d_expansion']===''?null:Number(row['1d_expansion']),expansionFlag:row['1d_expansion_flag']}));
 if(available){
  const raw=Number(available['1d_deforestation']),flag=available['1d_deforestation_flag'];
  const expansionRaw=available['1d_expansion'].trim()===''?null:Number(available['1d_expansion']);
  const expansion=Number.isFinite(expansionRaw)&&expansionRaw!==null&&['A','I'].includes(available['1d_expansion_flag'])?expansionRaw*1000:null;
  country.indicators.push({id:'gross-deforestation',name:'Gross forest area deforested',annualRate:raw*1000,unit:'hectares',ratePeriod:`${available.year} annual average · FRA 2025`,scope:`FAO reporting geography: ${country.name} (source code ${country.m49}). Gross deforestation, not net forest-area change or a count of trees.`,source:source('FAO Global Forest Resources Assessment 2025 — country intervals',faoUrl,{dataset:'FRA 2025',table:'1d_deforestation',referenceInterval:available.year,flag,flagDescription:flag==='I'?'Imputed value, desk study, data compiled by FAO':'Normal value, official data reported by country/area',rawValue:raw,rawUnit:'1000 hectares/year',conversionToHectares:1000,exportFilename:'Intervals_2026-10-27.csv',exportDateMeaning:'Download date, not publication or observation date'}),limitations:`Historical interval average. ${flag==='I'?'Flag I: FAO-imputed desk-study estimate, not direct measurement.':'Flag A: official country-reported data; still a reported annual average.'} Blank more-recent periods remain missing, not zero. ${expansion===null?'Same-period forest expansion is unavailable.':`Same-period forest expansion: ${expansion.toLocaleString('en-US')} hectares/year; gross deforestation alone does not establish net forest decline.`} Uniform-rate approximation.`});
  if(expansion!==null)country.observations.push({name:'Forest expansion — annual average',value:expansion,unit:'hectares/year',referencePeriod:available.year,scope:'FAO forest expansion in the same interval as gross deforestation. This is context, not an additional ticking harm counter.',source:source('FAO FRA 2025 — same-period forest expansion',faoUrl,{flag:available['1d_expansion_flag'],rawValue:expansionRaw,rawUnit:'1000 hectares/year'}),limitations:'Expansion and gross deforestation are separate flows. Neither by itself is net forest-area change. Source flags and interval series are retained in source data.'});
 }
}
const foodGroups=new Map();
for(const row of un.data){
 if(row.timePeriodStart!==2022 || !['HHS','OOHC','RTL'].includes(row.dimensions['Food Waste Sector']) || row.attributes.Units!=='TONNES')continue;
 const group=foodGroups.get(row.geoAreaCode)||[];group.push(row);foodGroups.set(row.geoAreaCode,group);
}
let foodCandidates=0,foodComparable=0;
const definitionExclusions=[];
for(const [m49,rows] of foodGroups){
 const country=countries.find(c=>c.m49!==null&&Number(c.m49)===Number(m49)) || byName.get(nameKey(rows[0].geoAreaName));
 if(!country)continue; // Regional aggregates never enter the country selector.
 country.sourceEvidence.food2022=rows;
 const eligible=rows.length===3&&new Set(rows.map(row=>row.dimensions['Food Waste Sector'])).size===3&&rows.every(row=>Number.isFinite(Number(row.value))&&Number(row.value)>=0&&(row.source==='Eurostat'||row.footnotes.some(note=>['High Confidence','Medium Confidence'].includes(note))));
 if(!eligible)continue;
 foodCandidates++;
 if(rows.some(row=>row.attributes['Observation Status']==='D')){definitionExclusions.push({id:country.id,name:country.name,reason:'Definition differs (D)',sectors:rows.filter(row=>row.attributes['Observation Status']==='D').map(row=>row.dimensions['Food Waste Sector'])});continue;}
 foodComparable++;
 const total=rows.reduce((sum,row)=>sum+Number(row.value),0),eurostat=rows.every(row=>row.source==='Eurostat');
 country.indicators.push({id:'food-waste',name:'Food waste generated — 3 sectors',annualRate:total,unit:'metric tonnes',ratePeriod:'2022 annual reference estimate',scope:'Households (HHS) + food service/out-of-home consumption (OOHC) + retail (RTL). Includes inedible parts; excludes pre-retail production/manufacturing losses.',source:source('UN SDG database, AG_FOOD_WST — matched three-sector country data',`${foodUrl}&areaCode=${m49}`,{series:'AG_FOOD_WST',m49,sourceCountryName:rows[0].geoAreaName,referenceYear:2022,method:'Sum HHS + OOHC + RTL; never use ALL',components:rows.map(row=>({sector:row.dimensions['Food Waste Sector'],tonnes:Number(row.value),source:row.source,confidence:row.footnotes.filter(note=>['High Confidence','Medium Confidence'].includes(note)),footnotes:row.footnotes,attributes:row.attributes,dimensions:row.dimensions}))}),trend:{direction:'not-established',period:'Across report editions',note:'A comparable trend is not established from different editions and study methods.',sourceUrl:'https://sdgs.unep.org/article/2a5-food-waste-index'},limitations:`${eurostat?'Eurostat sector records; A/E observation status and supplied footnotes are retained.':'All three sector estimates have UNEP High or Medium Confidence. Underlying study years vary; estimates are normalized to 2022 population and are not all directly measured in 2022.'} ALL totals are not used because they can include additional production/manufacturing sectors. Definition-differs (D) records are excluded. Uniform-rate estimate, not live events.`});
}
if(foodCandidates!==38||foodComparable!==36)throw new Error(`Unexpected food coverage ${foodCandidates}/${foodComparable}`);
for(const country of countries){
 for(const item of country.indicators){
  item.qualityNote=item.id==='fossil-industrial-co2'?'2024 annual estimate · public GCB 2025 v0.3':item.id==='gross-deforestation'?(item.source.flag==='I'?'Flag I: FAO-imputed desk-study estimate, not direct measurement':'Flag A: official country-reported annual average'):item.source.components.every(component=>component.source==='Eurostat')?(item.source.components.some(component=>component.attributes['Observation Status']==='E')?'Eurostat: includes estimated-value (E) components':'Eurostat: normal-value (A) components'):'UNEP High/Medium-confidence component estimates';
 }
 for(const observation of country.observations){
  if(observation.source.flag==='I')observation.limitations='Flag I: FAO-imputed desk-study estimate, not direct measurement. '+observation.limitations;
 }
 country.indicators.sort((a,b)=>['fossil-industrial-co2','gross-deforestation','food-waste'].indexOf(a.id)-['fossil-industrial-co2','gross-deforestation','food-waste'].indexOf(b.id));
 country.coverageNotes.push('Separate source periods and geographic definitions apply. These gauges are not a country ranking or an overall worsening score.');
 if(country.id==='CHN')country.coverageNotes.push('China uses FAO source code 159 and UN food-waste code 156. Each metric retains the publisher reporting geography; separately reported territories are not summed into this view.');
 for(const [id,name] of [['fossil-industrial-co2','Territorial fossil CO2'],['gross-deforestation','Gross deforestation'],['food-waste','Comparable three-sector food waste']]){
  if(country.indicators.some(item=>item.id===id))continue;
  const definition=definitionExclusions.find(item=>item.id===country.id);
  const reason=id==='food-waste'?(definition?'Excluded: at least one 2022 component is flagged D (Definition differs). No comparable three-sector counter is supplied.':'No matched 2022 HHS + OOHC + RTL estimate meets the High/Medium-confidence or Eurostat coverage rule. Household-only and ALL totals are not substituted.'):id==='gross-deforestation'?'FRA 2025 has no usable reported gross-deforestation interval for this geography. Missing/blank values are not zero; net forest change is not substituted.':'No separate 2024 territorial entry was matched in the public GCB v0.3 workbook. No allocation from world totals is made.';
  country.unavailableMetrics.push({name,reason});
 }
}
countries.sort((a,b)=>(a.id==='AUS'?-1:b.id==='AUS'?1:a.name.localeCompare(b.name,'en')));
const forestCountries=countries.filter(c=>c.indicators.some(item=>item.id==='gross-deforestation'));
const coverage={countriesAndAreas:countries.length,co2:countries.filter(c=>c.indicators.some(item=>item.id==='fossil-industrial-co2')).length,grossDeforestation:forestCountries.length,foodWaste:foodComparable,forestPeriods:Object.fromEntries(periods.map(period=>[period,forestCountries.filter(c=>c.indicators.find(item=>item.id==='gross-deforestation').source.referenceInterval===period).length])),forestFlags:Object.fromEntries(['A','I'].map(flag=>[flag,forestCountries.filter(c=>c.indicators.find(item=>item.id==='gross-deforestation').source.flag===flag).length]))};
if(coverage.co2!==214||coverage.grossDeforestation!==139||coverage.forestFlags.I!==15)throw new Error('Country coverage does not match source audit');
const checksum=async filename=>createHash('sha256').update(await readFile(path.join(directory,filename))).digest('hex');
const manifest={verified:date,coverage,sources:[{id:'gcb-country',url:'https://globalcarbonbudget.org/download/2345/?tmstv=1762815968',filename:'National_Fossil_Carbon_Emissions_2025_v0.3.xlsx',version:'v0.3',sha256:await checksum('National_Fossil_Carbon_Emissions_2025_v0.3.xlsx'),sheet:'Territorial Emissions',headersRow:12,dataRow:187,referenceYear:2024,countryColumns:'B:HG',conversion:'MtC × 3.664 × 1,000,000 = tonnes CO2',excludedColumns:'HH:HX: regional aggregates, international aviation/shipping, statistical difference and World',balanceCheck:{countryMtC,bunkersMtC:bunkers,worldMtC:workbookWorld,residualMtC:countryMtC+bunkers-workbookWorld},accessRoute:'Independently public publisher workbook; no gated ICOS licence endpoint used.'},{id:'fao-country',url:'https://fra-data.fao.org/api/file/bulk-download?assessmentName=fra&countryIso=WO&cycleName=2025&includeClimaticDomain=false&includeVoluntaryUpdates=false&lang=en',sha256:await checksum('fao-internal-source.zip'),dataset:'FRA 2025',file:'Intervals_2026-10-27.csv',exportDateMeaning:'Download date only, as explained in archive README',countryRows:236,conversion:'1000 hectares/year × 1000 = hectares/year',selection:'Latest nonblank gross-deforestation interval with A or I flag; preserve zero, exclude missing O/M; same-period expansion context',flagDefinitions:{A:'Normal value, official data reported by country/area',I:'Imputed value, desk study, data compiled by FAO',O:'Missing value',M:'Missing value; cannot exist, denominator zero or missing'}},{id:'un-food-country',url:foodUrl,sha256:await checksum('un-food-waste.json'),series:'AG_FOOD_WST',rawRows:un.data.length,referenceYear:2022,selection:'HHS + OOHC + RTL; each UNEP High/Medium Confidence or Eurostat; exclude D; no ALL totals',candidates:38,comparable:36,excluded:definitionExclusions,attributes:un.attributes,dimensions:un.dimensions}],geographyAliases:aliases,extraSourceGeographies:extra,rawEvidence:'Each country retains raw MtC cell, forest interval values/flags, food components/confidence/footnotes/statuses in indicators.json.'};
root.version='2026-10-27.2-countries';root.countries=countries;root.countryCoverage=coverage;root.provenanceManifest='data/source-manifest.json';
validateDataset(root);
await writeFile(new URL('../data/indicators.json',import.meta.url),JSON.stringify(root,null,2)+'\n');
await writeFile(new URL('../data/source-manifest.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({coverage,australia:byId.get('AUS').indicators.map(item=>({id:item.id,annualRate:item.annualRate,period:item.ratePeriod})),australiaExpansion:byId.get('AUS').observations,excluded:definitionExclusions},null,2));
