import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseMesh,MeshFormatError} from '../src/mesh.js';
import {decodeTexture} from '../src/texture.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const privateRoot=path.resolve(here,'../../../work/medieval2/private-assets');
function walk(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).filter(item=>!['.git','node_modules','__pycache__'].includes(item.name)).flatMap(item=>item.isDirectory()?walk(path.join(dir,item.name)):[path.join(dir,item.name)]);}
const files=walk(privateRoot);
test('malformed mesh and texture files fail clearly',()=>{
  for(const length of [0,4,20,500])assert.throws(()=>parseMesh(new Uint8Array(length)),MeshFormatError);
  assert.throws(()=>decodeTexture(new Uint8Array(128)),/Expected DDS/);
});
test('DXT1 block decoding preserves opaque red and transparent pixels',()=>{
  const data=new Uint8Array(136),v=new DataView(data.buffer);data.set([68,68,83,32]);v.setUint32(4,124,true);v.setUint32(12,4,true);v.setUint32(16,4,true);data.set([68,88,84,49],84);v.setUint16(128,0xf800,true);v.setUint16(130,0x07e0,true);
  const decoded=decodeTexture(data);assert.deepEqual([...decoded.pixels.slice(0,4)],[255,0,0,255]);
  v.setUint16(128,0,true);v.setUint16(130,0xffff,true);v.setUint32(132,0xffffffff,true);assert.equal(decodeTexture(data).pixels[3],0);
  assert.throws(()=>decodeTexture(data.slice(0,133)),/truncated/);
});
for(const file of files.filter(name=>name.endsWith('.mesh')))test('installed model: '+path.basename(file),()=>{
  const model=parseMesh(fs.readFileSync(file));assert(model.vertexCount>0);assert(model.bones.length>0);assert(model.trailingBytes<8192);assert.equal(model.attributes[0].length,model.vertexCount*3);assert.equal(model.attributes[4].length,model.vertexCount*2);
  for(const group of model.groups)assert([...group.indices].every(i=>i<model.vertexCount));
  if(path.basename(file)==='spear_militia_lod0.mesh'){assert.equal(model.vertexCount,3263);assert.equal(model.bones.length,26);assert.equal(model.groups.length,22);}
});
for(const file of files.filter(name=>name.endsWith('.texture')))test('installed texture: '+path.basename(file),()=>{
  const texture=decodeTexture(fs.readFileSync(file));assert(texture.width>0);assert.equal(texture.pixels.length,texture.width*texture.height*4);assert.equal(texture.ddsOffset,48);assert(texture.pixels.some((value,i)=>i%4!==3&&value>0));
});
test('private game assets are not copied into the deliverable package',()=>{
  const codeRoot=path.resolve(here,'..');for(const file of walk(codeRoot))assert(!/\.(mesh|texture|pack|cas|modeldb)$/i.test(file),file);
});
