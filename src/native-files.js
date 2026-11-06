import {parseAnimation} from './animation.js';
import {cleanPath} from './pack.js';

export function catalogueFromModeldb(text) {
  if(text.length>64*1024*1024)throw new Error('Model database exceeds the 64 MiB limit');
  const candidates=/(?<!\S)(\d+)\s+([a-z][a-z0-9_]*)(?=\s)/ig,records=new Map();let match;
  const title=value=>value.split('_').map(word=>word?word[0].toUpperCase()+word.slice(1):'').join(' ');
  while((match=candidates.exec(text))&&records.size<10000){
    let at=candidates.lastIndex;
    const number=()=>{const token=/^\s*([-+\d.eE]+)/.exec(text.slice(at));if(!token)throw new Error('bad number');at+=token[0].length;const n=Number(token[1]);if(!Number.isFinite(n))throw new Error('bad value');return n;};
    const count=max=>{const n=number();if(!Number.isSafeInteger(n)||n<0||n>max)throw new Error('bad count');return n;};
    const string=()=>{const n=count(8192);if(/\s/.test(text[at]??''))at++;if(at+n>text.length)throw new Error('truncated string');const value=text.slice(at,at+n);at+=n;return value;};
    try{
      const sets=count(128);if(!sets)continue;const models=[];
      for(let set=0;set<sets;set++){const lods=count(64);if(!lods)throw new Error('empty LOD set');for(let lod=0;lod<lods;lod++){const path=string();number();if(!/^unit_models\/.+\.mesh$/i.test(path)||path.includes('..'))throw new Error('invalid model path');models.push(path);}}
      const tables=[];
      for(let table=0;table<2;table++){const factions=new Map(),n=count(256);for(let i=0;i<n;i++){const faction=string(),values=[string(),string(),string()];if(!/^[a-z][a-z0-9_]*$/i.test(faction))throw new Error('invalid faction');factions.set(faction.toLowerCase(),values);}tables.push(factions);}
      if(!tables[0].size||!tables[1].size)continue;
      const id=match[1],name=match[2].toLowerCase();
      for(const [faction,main] of tables[0]){
        const attachment=tables[1].get(faction);if(!attachment||!main[0].toLowerCase().endsWith('.texture')||!attachment[0].toLowerCase().endsWith('.texture'))continue;
        const mesh=models[0],key=`${id}-${name}-${faction}`;
        records.set(key,{id:key,name:title(name),faction:title(faction),mesh:'/assets/data/'+cleanPath(mesh),main:'/assets/data/'+cleanPath(main[0]),attachment:'/assets/data/'+cleanPath(attachment[0]),modeldbName:name,modeldbId:id,lods:models.map(path=>'/assets/data/'+cleanPath(path))});
      }
    }catch{}
  }
  const entries=[...records.values()];if(!entries.length)throw new Error('The model database has no supported model entries');return entries;
}

export function parseAnimationIndex(input) {
  const b=new Uint8Array(input),v=new DataView(input),magic=String.fromCharCode(...b.subarray(0,9));
  if(b.length<20||!['ANIM.PACK','SKEL.PACK'].includes(magic))throw new Error('Invalid animation index');
  const count=v.getUint32(16,true);if(count>100000)throw new Error('Animation index has too many entries');
  let at=20;const entries=new Map(),decoder=new TextDecoder('windows-1252');
  for(let i=0;i<count;i++){
    if(at+12>b.length)throw new Error('Truncated animation index');
    const length=v.getUint32(at,true),offset=v.getUint32(at+4,true),size=v.getUint32(at+8,true);at+=12;
    const end=at+length,start=at+(magic==='ANIM.PACK'?9:0);
    if(!length||length>4096||start>=end||end>b.length||b[end-1]!==0)throw new Error('Invalid animation-index record');
    const name=decoder.decode(b.subarray(start,end-1));entries.set(cleanPath(name),{name,offset,size});at=end;
  }
  if(at!==b.length)throw new Error('Unexpected animation-index tail');return entries;
}

export function parseSkeleton(input) {
  const b=new Uint8Array(input),v=new DataView(input);let at=10;
  const need=n=>{if(at+n>b.length)throw new Error('Truncated skeleton');};
  if(b.length<10)throw new Error('Skeleton header is truncated');
  const scale=v.getFloat32(0,true),count=v.getUint16(4,true);if(!count||count>256)throw new Error('Invalid skeleton bone count');
  const decoder=new TextDecoder('windows-1252');
  const string=(event=false)=>{const start=at;while(at<b.length&&b[at]!==0&&!(event&&b[at]===1))at++;if(at>=b.length)throw new Error('Truncated skeleton string');const name=decoder.decode(b.subarray(start,at));at++;return name;};
  const bones=[];
  for(let i=0;i<count;i++){need(76);const pivot=[v.getFloat32(at+4,true),v.getFloat32(at+8,true),v.getFloat32(at+12,true)],parent=v.getInt32(at+16,true);at+=76;const name=string();if(parent>=i||parent < -1||pivot.some(n=>!Number.isFinite(n)))throw new Error('Invalid skeleton bone');bones.push({name,parent,pivot});}
  const slots=[];
  for(let slot=0;slot<687;slot++){
    need(1);if(b[at]===0){at++;continue;}const path=string();need(46);at+=42;const events=v.getUint32(at,true);at+=4;if(events>10000)throw new Error('Invalid skeleton events');
    for(let i=0;i<events;i++){need(8);at+=8;string(true);need(2);at+=2;}need(6);at+=6;slots.push({slot,path});
  }
  return {scale,bones,slots};
}

export async function nativeLibraryFromGame(reader) {
  const animationIndex=parseAnimationIndex(await reader.read('data/animations/pack.idx'));
  const skeletonIndex=parseAnimationIndex(await reader.read('data/animations/skeletons.idx'));
  const spec={},clips=new Map(),attachments=[];
  for(const name of ['MTW2_Spear','MTW2_Spear_primary','fs_test_shield']){
    const entry=skeletonIndex.get(name.toLowerCase());if(!entry)throw new Error(`Missing original skeleton ${name}`);
    spec[name]=parseSkeleton(await reader.range('data/animations/skeletons.dat',entry.offset,entry.size));
  }
  async function clipAt(path){const entry=animationIndex.get(cleanPath(path));if(!entry)throw new Error(`Missing native animation ${path}`);return parseAnimation(await reader.range('data/animations/pack.dat',entry.offset,entry.size));}
  for(const [id,suffix] of [['idle','mtw2_spear_stand_a_idle.cas'],['walk','mtw2_spear_walk.cas'],['run','mtw2_spear_run.cas']]){
    const slot=spec.MTW2_Spear.slots.find(slot=>cleanPath(slot.path).endsWith('/'+suffix));if(!slot)throw new Error(`Missing native ${id} clip`);
    clips.set(id,{id,name:id[0].toUpperCase()+id.slice(1),nativePath:slot.path,data:await clipAt(slot.path)});
  }
  for(const [id,name] of [['primary','MTW2_Spear_primary'],['shield','fs_test_shield']]){
    const slot=spec[name].slots.find(slot=>animationIndex.has(cleanPath(slot.path)));if(slot)attachments.push({id,rig:name,clip:await clipAt(slot.path)});
  }
  return {spec,clips,attachments};
}
