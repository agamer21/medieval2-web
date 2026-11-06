import {lzo1xDecompress} from '../vendor/lzo1x/index.js';
const CHUNK=65536,MAX_EXTRACT=64*1024*1024;
export const cleanPath=name=>name.replaceAll('\\','/').replace(/^\/+/, '').toLowerCase();
export function blobSource(blob){return {size:blob.size,read:async(offset,length)=>new Uint8Array(await blob.slice(offset,offset+length).arrayBuffer())};}
function exactBytes(bytes,count){if(bytes.byteLength!==count)throw new Error('Archive read ended early');return bytes;}
export async function openPack(source) {
  const head=exactBytes(await source.read(0,24),24),view=new DataView(head.buffer,head.byteOffset,head.byteLength);
  if(String.fromCharCode(...head.subarray(0,4))!=='PACK'||view.getUint16(4,true)!==0||view.getUint16(6,true)!==3)throw new Error('Expected a Medieval II version-3 PACK archive');
  const count=view.getUint32(8,true),indexBytes=view.getUint32(12,true),blocks=view.getUint32(16,true);
  if(!count||count>200000||blocks>2000000)throw new Error('Invalid archive counts');
  const blockTableAt=24+(count-1)*4,recordsAt=blockTableAt+blocks*4,total=recordsAt+indexBytes;
  if(total>32*1024*1024||total>source.size)throw new Error('Invalid archive index range');
  const bytes=exactBytes(await source.read(0,total),total),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const blockSizes=new Uint32Array(blocks);for(let i=0;i<blocks;i++){blockSizes[i]=v.getUint32(blockTableAt+i*4,true);if(!blockSizes[i]||blockSizes[i]>66000)throw new Error('Invalid compressed block size');}
  const entries=new Map(),decoder=new TextDecoder('windows-1252');let previous=-1;
  for(let i=0;i<count;i++){
    const relative=i===0?0:v.getUint32(24+(i-1)*4,true),at=recordsAt+relative;
    const end=i===count-1?total:recordsAt+v.getUint32(24+i*4,true);
    if(relative<=previous||at+17>end||end>total)throw new Error('Invalid archive record offsets');previous=relative;
    const offset=v.getUint32(at,true),firstBlock=v.getUint32(at+4,true),size=v.getUint32(at+8,true),packed=v.getUint32(at+12,true),nblocks=Math.ceil(size/CHUNK);
    let nameEnd=at+16;while(nameEnd<end&&bytes[nameEnd])nameEnd++;
    if(nameEnd===end)throw new Error('Unterminated archive filename');
    const name=cleanPath(decoder.decode(bytes.subarray(at+16,nameEnd)));
    if(!name.startsWith('data/')||name.split('/').includes('..'))throw new Error('Unsafe archive filename');
    if(firstBlock+nblocks>blocks||offset+packed>source.size||(size&&offset<total))throw new Error('Archive member extends outside its file');
    let stored=0;for(let b=0;b<nblocks;b++)stored+=blockSizes[firstBlock+b];
    if(stored!==packed)throw new Error('Archive block sizes do not match the member record');
    entries.set(name,{name,offset,firstBlock,size,packed,blocks:nblocks});
  }
  async function extract(name){
    const entry=entries.get(cleanPath(name));if(!entry)throw new Error(`Archive does not contain ${name}`);
    if(entry.size>MAX_EXTRACT)throw new Error('Selected asset exceeds the 64 MiB decoding limit');
    const out=new Uint8Array(entry.size);let cursor=entry.offset,written=0;
    for(let block=0;block<entry.blocks;block++){
      const stored=blockSizes[entry.firstBlock+block],wanted=Math.min(CHUNK,entry.size-written);
      const input=exactBytes(await source.read(cursor,stored),stored);
      const data=stored===wanted?input:lzo1xDecompress(input,wanted);
      if(data.length!==wanted)throw new Error('Decoded archive block has the wrong length');out.set(data,written);written+=data.length;cursor+=stored;
    }
    return out.buffer;
  }
  return {entries,extract,indexBytes:total,fileCount:count};
}

export async function openGameFiles(files,onProgress=()=>{}) {
  const loose=new Map();
  for(const file of files){let path=cleanPath(file.webkitRelativePath||file.name);if(file.webkitRelativePath)path=path.split('/').slice(1).join('/');loose.set(path,file);}
  const packed=[...loose].filter(([name])=>/^packs\/[^/]+\.pack$/.test(name)).sort(([a],[b])=>a.localeCompare(b));
  if(!packed.length)throw new Error('Choose the Medieval II installation folder containing packs/.');
  const readers=[];const lookup=new Map();let metadataBytes=0;
  for(const [name,file] of packed){onProgress(`Reading ${name} (${readers.length+1}/${packed.length})…`);const pack=await openPack(blobSource(file));readers.push(pack);metadataBytes+=pack.indexBytes;for(const name of pack.entries.keys())lookup.set(name,pack);}
  const cache=new Map();
  async function read(path){const name=cleanPath(path.replace(/^\/assets\//,''));
    if(cache.has(name))return cache.get(name);
    let bytes;
    if(loose.has(name)){const file=loose.get(name);if(file.size>MAX_EXTRACT)throw new Error('Asset too large; use a range read for animation DAT files');bytes=await file.arrayBuffer();}
    else{const pack=lookup.get(name);if(!pack)throw new Error(`Missing original asset ${name}`);bytes=await pack.extract(name);}
    cache.set(name,bytes);return bytes;
  }
  async function range(path,offset,length){const file=loose.get(cleanPath(path));if(!file)throw new Error(`Missing ${path}`);if(offset<0||length<0||offset+length>file.size||length>MAX_EXTRACT)throw new Error('Invalid file range');return file.slice(offset,offset+length).arrayBuffer();}
  return {read,range,metadataBytes,packCount:readers.length,memberCount:lookup.size};
}
