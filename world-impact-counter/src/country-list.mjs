export const COUNTRY_METRICS = {
 'fossil-industrial-co2':{title:'Highest reported CO2 emissions',note:'2024 annual territorial fossil CO2 estimates, public GCB 2025 v0.3. International aviation/shipping is excluded. This is an indicator quantity order, not an overall country score.',missingName:'Territorial fossil CO2'},
 'gross-deforestation':{title:'Highest reported gross deforestation',note:'Mixed reference periods: 2010–2015, 2015–2020 and 2020–2025. Values are annual averages, not a same-year ranking. Official and FAO-imputed estimates are labelled. Gross deforestation is not net forest loss.',missingName:'Gross deforestation'},
 'food-waste':{title:'Highest reported three-sector food waste',note:'2022 reference estimates for households, food service and retail. Study years, confidence and Eurostat/UNEP methods vary. Coverage is limited; non-comparable or missing countries are listed separately.',missingName:'Comparable three-sector food waste'}
};
export function rankCountries(countries,metricId='fossil-industrial-co2',query=''){
 if(!COUNTRY_METRICS[metricId])throw new Error('Unknown country-list indicator');
 const term=query.trim().toLocaleLowerCase();const available=[],missing=[];
 for(const country of countries||[]){
  if(country.id==='WORLD')continue;
  if(term&&!`${country.name} ${country.id} ${(country.searchAliases||[]).join(' ')}`.toLocaleLowerCase().includes(term))continue;
  const indicator=country.indicators?.find(item=>item.id===metricId);
  if(indicator&&Number.isFinite(indicator.annualRate)&&indicator.annualRate>=0)available.push({country,indicator});
  else missing.push({country,reason:country.unavailableMetrics?.find(item=>item.name===COUNTRY_METRICS[metricId].missingName)?.reason || 'No comparable reported value is available in this dataset.'});
 }
 const names=(a,b)=>a.country.name.localeCompare(b.country.name,'en')||a.country.id.localeCompare(b.country.id);
 available.sort((a,b)=>b.indicator.annualRate-a.indicator.annualRate||names(a,b));missing.sort(names);
 let lastValue=null,rank=0;
 available.forEach((item,index)=>{if(item.indicator.annualRate!==lastValue){rank=index+1;lastValue=item.indicator.annualRate;}item.rank=rank;});
 return {metricId,...COUNTRY_METRICS[metricId],available,missing};
}
const number=new Intl.NumberFormat('en',{maximumFractionDigits:1});
export function listRowText(item){
 if(!item.indicator)return {name:item.country.name,value:'Unavailable',period:item.reason,quality:''};
 return {name:item.country.name,value:`≈ ${number.format(item.indicator.annualRate)} ${item.indicator.unit}/year`,period:item.indicator.ratePeriod,quality:item.indicator.qualityNote || 'Published annual estimate'};
}
export function renderCountryList(container,result,selectedId){
 const make=(tag,className,text)=>{const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;};
 const section=(items,missing)=>{
  const list=make('ol',missing?'country-missing-list':'country-available-list');
  for(const item of items){
   const text=listRowText(item),li=make('li',''),button=make('button','country-row');
   button.type='button';button.setAttribute('data-country-id',item.country.id);button.setAttribute('data-country-name',item.country.name);button.setAttribute('aria-pressed',String(selectedId===item.country.id));
   if(item.indicator)button.setAttribute('data-annual-quantity',String(item.indicator.annualRate));
   button.append(make('span','country-row-name',`${missing?'':`#${item.rank} `}${text.name}`),make('span','country-row-quantity',text.value),make('span','country-row-period',text.period));
   if(text.quality)button.append(make('span','country-row-quality',text.quality));
   li.append(button);list.append(li);
  }
  return list;
 };
 container.replaceChildren(section(result.available,false));
 if(!result.available.length)container.append(make('p','country-list-empty','No matching countries with comparable values. Try another indicator or clear the filter.'));
 if(result.missing.length)container.append(make('h4','country-missing-heading',`Unavailable / non-comparable (${result.missing.length})`),section(result.missing,true));
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function countryListHtml(result){
 const list=(items,missing)=>`<ol class="${missing?'country-missing-list':'country-available-list'}">\n${items.map(item=>{const text=listRowText(item);return `<li><button type="button" class="country-row" data-country-id="${escape(item.country.id)}" data-country-name="${escape(item.country.name)}" aria-pressed="false"${item.indicator?` data-annual-quantity="${item.indicator.annualRate}"`:''}><span class="country-row-name">${escape(`${missing?'':`#${item.rank} `}${text.name}`)}</span><span class="country-row-quantity">${escape(text.value)}</span><span class="country-row-period">${escape(text.period)}</span>${text.quality?`<span class="country-row-quality">${escape(text.quality)}</span>`:''}</button></li>`;}).join('\n')}\n</ol>`;
 return list(result.available,false)+(result.missing.length?`<h4 class="country-missing-heading">Unavailable / non-comparable (${result.missing.length})</h4>`+list(result.missing,true):'');
}
