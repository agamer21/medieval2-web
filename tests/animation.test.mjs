import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseAnimation,NativeRig,makeSkinMap,skinVertices} from '../src/animation.js';
import {parseMesh} from '../src/mesh.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../work/medieval2/private-assets');
const animationRoot=path.join(root,'native-animation');
test('truncated and inconsistent animation tracks fail',()=>{
  assert.throws(()=>parseAnimation(new Uint8Array(8)),/truncated/);
  assert.throws(()=>parseAnimation(new Uint8Array(50)),/counts/);
});
if(fs.existsSync(animationRoot)){
 const specs=JSON.parse(fs.readFileSync(path.join(animationRoot,'skeletons.json'),'utf8'));
 for(const name of ['idle','walk','run','primary','shield'])test('original animation '+name,()=>{
  const raw=fs.readFileSync(path.join(animationRoot,name+'.anim')),clip=parseAnimation(raw);assert(clip.frames>0);assert(clip.duration>=0);assert.equal(clip.movingBones.length,clip.moving);assert.throws(()=>parseAnimation(raw.subarray(0,raw.length-1)),/length/);
 });
 test('native hierarchy and weighted skinning produce finite, changing unit geometry',()=>{
  const mesh=parseMesh(fs.readFileSync(path.join(root,'data/unit_models/_units/en_peasant_padded/spear_militia_lod0.mesh')));
  const rig=new NativeRig(specs.MTW2_Spear),primary=new NativeRig(specs.MTW2_Spear_primary),shield=new NativeRig(specs.fs_test_shield);
  const clip=parseAnimation(fs.readFileSync(path.join(animationRoot,'walk.anim'))),extraClip=parseAnimation(fs.readFileSync(path.join(animationRoot,'primary.anim'))),shieldClip=parseAnimation(fs.readFileSync(path.join(animationRoot,'shield.anim')));
  const map=makeSkinMap(mesh,rig,[primary,shield]),p=new Float32Array(mesh.vertexCount*3),n=new Float32Array(p.length);
  const pose=t=>{rig.pose(clip,t);primary.pose(extraClip,t,rig.world[rig.names.get('bone_rhand')]);shield.pose(shieldClip,t,rig.world[rig.names.get('bone_lhand')]);skinVertices(mesh,map,p,n);};
  pose(0);const before=p.slice();pose(.2);assert(p.some((value,i)=>Math.abs(value-before[i])>.01));assert([...p].every(value=>Number.isFinite(value)&&Math.abs(value)<20));
  for(let i=0;i<n.length;i+=3)assert(Math.abs(Math.hypot(n[i],n[i+1],n[i+2])-1)<.002);
  const broken=structuredClone(specs.MTW2_Spear);broken.bones[0].parent=1;assert.throws(()=>new NativeRig(broken),/hierarchy/);
 });
}
