import {parseAnimation} from './animation.js';
import {cleanPath} from './pack.js';

export function catalogueFromModeldb(text) {
  const match=/(?:^|\s)13 spear_militia(?=\s)/i.exec(text);
  if(!match)throw new Error('The model database has no supported spear-militia entry');
  let at=match.index+match[0].length;
  const number=()=>{const token=/^\s*([-+\d.eE]+)/.exec(text.slice(at));if(!token)throw new Error('Invalid model database number');at+=token[0].length;const n=Number(token[1]);if(!Number.isFinite(n))throw new Error('Invalid model database value');return n;};
  const count=()=>{const n=number();if(!Number.isSafeInteger(n)||n<0||n>10000)throw new Error('Invalid model database count');return n;};
  const string=()=>{const n=count();if(/\s/.test(text[at]??''))at++;if(at+n>text.length)throw new Error('Truncated model database string');const value=text.slice(at,at+n);at+=n;return value;};
  const models=[];for(let set=0,sets=count();set<sets;set++)for(let lod=0,lods=count();lod<lods;lod++){models.push(string());number();}
  const tables=[];
  for(let table=0;table<2;table++){const factions=new Map();for(let i=0,n=count();i<n;i++){const faction=string();factions.set(faction,[string(),string(),string()]);}tables.push(factions);}
  const entries=[];
  for(const faction of ['england','france']){
    if(!tables[0].has(faction)||!tables[1].has(faction))continue;
    entries.push({id:`spear-militia-${faction}`,name:'Spear Militia',faction:faction[0].toUpperCase()+faction.slice(1),mesh:'/assets/data/'+cleanPath(models[0]),main:'/assets/data/'+cleanPath(tables[0].get(faction)[0]),attachment:'/assets/data/'+cleanPath(tables[1].get(faction)[0])});
  }
  if(!entries.length)throw new Error('The selected game has no supported sample faction textures');
  return entries;
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
