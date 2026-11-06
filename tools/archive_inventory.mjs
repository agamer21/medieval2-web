import fs from 'node:fs';
import path from 'node:path';
import {openPack} from '../src/pack.js';
const game=process.argv[2]??'C:/Program Files (x86)/Steam/steamapps/common/Medieval II Total War';
const output=process.argv[3]??new URL('../../../work/medieval2/archive-inventory.json',import.meta.url);
const summary={scope:'Base-game PACK member names and sizes; unsupported formats are inventoried, not decoded.',archives:[],extensions:{},categories:{},mapSamples:[]};
for(const name of fs.readdirSync(path.join(game,'packs')).filter(name=>name.endsWith('.pack')).sort()){
 const filename=path.join(game,'packs',name),handle=await fs.promises.open(filename,'r');
 try{const stat=await handle.stat();const pack=await openPack({size:stat.size,read:async(offset,size)=>{const b=Buffer.alloc(size);const r=await handle.read(b,0,size,offset);return b.subarray(0,r.bytesRead)}});
 summary.archives.push({name,bytes:stat.size,members:pack.fileCount,indexBytes:pack.indexBytes});
 for(const entry of pack.entries.values()){
  const ext=path.extname(entry.name)||'(none)',category=entry.name.split('/')[1]??'(root)';
  summary.extensions[ext]=(summary.extensions[ext]??0)+1;summary.categories[category]=(summary.categories[category]??0)+1;
  if(entry.name.startsWith('data/world/maps/battle/')&&summary.mapSamples.length<12)summary.mapSamples.push(entry.name);
 }
 }finally{await handle.close()}
}
fs.writeFileSync(output,JSON.stringify(summary,null,2));
console.log(JSON.stringify({archives:summary.archives.length,members:summary.archives.reduce((n,a)=>n+a.members,0),extensions:Object.fromEntries(Object.entries(summary.extensions).sort((a,b)=>b[1]-a[1]).slice(0,12)),mapSamples:summary.mapSamples.slice(0,4)},null,2));
