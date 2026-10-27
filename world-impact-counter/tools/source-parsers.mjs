export function parseCsv(text) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
    else if(c==='"')quoted=true;
    else if(c===','){row.push(cell);cell='';}
    else if(c==='\n'){row.push(cell.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('Unclosed CSV quote');
  if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
  const header=rows.shift()?.map(value=>value.replace(/^\uFEFF/,''));
  if(!header)throw new Error('Missing CSV header');
  return rows.map(values=>Object.fromEntries(header.map((name,i)=>[name,values[i]??''])));
}
export function spreadsheetRows(sharedXml,sheetXml){
 const decode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
 const shared=[...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t=>decode(t[1])).join(''));
 return new Map([...sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)].map(m=>[Number(/\br="(\d+)"/.exec(m[1])?.[1]),Object.fromEntries([...m[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(c=>{const v=/<v>([\s\S]*?)<\/v>/.exec(c[2]||'')?.[1];return [/\br="([A-Z]+)\d+"/.exec(c[1])?.[1],v===undefined?undefined:/\bt="s"/.test(c[1])?shared[Number(v)]:v];}).filter(x=>x[1]!==undefined))]));
}
export function nameKey(name){return name.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[^a-z0-9]/g,'');}
