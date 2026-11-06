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
if(fs.existsSync(privateRoot))test('modeldb selections match the privately prepared faction catalogue',()=>{
 const text=fs.readFileSync(path.join(privateRoot,'data/unit_models/battle_models.modeldb'),'latin1');const actual=catalogueFromModeldb(text);const expected=JSON.parse(fs.readFileSync(path.join(privateRoot,'catalog.json'),'utf8')).entries;assert.deepEqual(actual,expected);
});
