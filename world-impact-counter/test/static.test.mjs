import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('all module imports resolve to exported local source files',async()=>{
  for(const name of await readdir(path.join(root,'src'))){
    if(!name.endsWith('.mjs'))continue;
    const file=path.join(root,'src',name), text=await readFile(file,'utf8');
    for(const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)){
      assert.ok(match[1].startsWith('./'));
      assert.ok((await stat(path.resolve(path.dirname(file),match[1]))).isFile());
    }
  }
});
test('all fixed UI controls have unique HTML targets and declared local assets exist',async()=>{
  const html=await readFile(path.join(root,'index.html'),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(ids).size,ids.length);
  for(const file of ['src/app.mjs','src/noaa.mjs']){
    const source=await readFile(path.join(root,file),'utf8');
    for(const match of source.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]),`${file}: missing ${match[1]}`);
  }
  for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
    if(match[1].startsWith('https:') || match[1]==='./')continue;
    assert.ok((await stat(path.resolve(root,match[1]))).isFile());
  }
});
