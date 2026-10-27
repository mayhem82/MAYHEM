import {readFile,writeFile} from 'node:fs/promises';
import {rankCountries,countryListHtml} from '../src/country-list.mjs';
const data=JSON.parse(await readFile(new URL('../data/indicators.json',import.meta.url),'utf8'));
const url=new URL('../index.html',import.meta.url);let html=await readFile(url,'utf8');
if(!html.includes('<!-- COUNTRY_LIST_START -->')||!html.includes('<!-- COUNTRY_LIST_END -->'))throw new Error('Missing static country-list markers');
const result=rankCountries(data.countries);
html=html.replace(/<!-- COUNTRY_LIST_START -->[\s\S]*?<!-- COUNTRY_LIST_END -->/,`<!-- COUNTRY_LIST_START -->\n${countryListHtml(result)}\n<!-- COUNTRY_LIST_END -->`);
await writeFile(url,html);
console.log(`Rendered ${result.available.length} available + ${result.missing.length} unavailable country buttons, largest CO2 quantities first.`);
