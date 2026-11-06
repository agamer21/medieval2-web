import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openPack} from '../src/pack.js';
import {catalogueFromModeldb,parseAnimationIndex,parseSkeleton} from '../src/native-files.js';
const privateRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../work/medieval2/private-assets');
test('invalid archive headers and index ranges are rejected before payload reads',async()=>{
 const buffer=new Uint8Array(24);await assert.rejects(openPack({size:24,read:async()=>buffer}),/Expected/);
 buffer.set([80,65,67,75]);const v=new DataView(buffer.buffer);v.setUint16(6,3,true);v.setUint32(8,1,true);v.setUint32(12,10000000,true);
 await assert.rejects(openPack({size:24,read:async()=>buffer}),/range/);
});
test('invalid model databases and animation indexes fail clearly',()=>{
 assert.throws(()=>catalogueFromModeldb('not a model database'),/no supported/);
 assert.throws(()=>parseAnimationIndex(new ArrayBuffer(20)),/Invalid animation index/);
 assert.throws(()=>parseSkeleton(new ArrayBuffer(2)),/truncated/);
});
test('modeldb reader exposes every valid model record and faction entry',()=>{
 const str=value=>`${value.length} ${value}`;
 const text=`13 spear_militia 1 1 ${str('unit_models/spear_militia_lod0.mesh')} 100 1 ${str('england')} ${str('unit_models/spear.texture')} ${str('unit_models/spear_normal.texture')} ${str('unit_sprites/spear.spr')} 1 ${str('england')} ${str('unit_models/shield.texture')} ${str('unit_models/shield_normal.texture')} ${str('unit_sprites/shield.spr')}`;
 const entries=catalogueFromModeldb(text);assert.equal(entries.length,1);assert.equal(entries[0].modeldbName,'spear_militia');assert.equal(entries[0].faction,'England');assert.match(entries[0].mesh,/spear_militia_lod0\.mesh$/);assert.equal(entries[0].lods.length,1);
});
if(fs.existsSync(privateRoot))test('installed model database yields a broad local model catalogue',()=>{
 const text=fs.readFileSync(path.join(privateRoot,'data/unit_models/battle_models.modeldb'),'latin1'),actual=catalogueFromModeldb(text);const expected=JSON.parse(fs.readFileSync(path.join(privateRoot,'catalog.json'),'utf8')).entries;
 assert(actual.length>expected.length);assert(actual.some(e=>e.modeldbName==='spear_militia'&&e.faction==='England'));assert(actual.every(e=>e.mesh.startsWith('/assets/data/unit_models/')&&e.main.endsWith('.texture')));assert.equal(new Set(actual.map(e=>e.id)).size,actual.length);
});
