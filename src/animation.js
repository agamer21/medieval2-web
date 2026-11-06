import * as THREE from '../vendor/three/three.module.js';

export function parseAnimation(input) {
  const buffer=input instanceof ArrayBuffer?input:input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength);
  const view=new DataView(buffer);
  if(buffer.byteLength<45)throw new Error('Animation header is truncated');
  const frames=view.getUint16(0,true),bones=view.getUint16(2,true),moving=view.getUint8(4);
  if(!frames||frames>10000||!bones||bones>256||moving>64)throw new Error('Invalid animation counts');
  if(buffer.byteLength!==5+frames*(bones*16+moving*12+24)+40)throw new Error('Animation length does not match its frame counts');
  let at=5;
  const floats=count=>{const out=new Float32Array(count);for(let i=0;i<count;i++){out[i]=view.getFloat32(at,true);at+=4;if(!Number.isFinite(out[i]))throw new Error('Nonfinite animation data');}return out;};
  const rotations=floats(frames*bones*4),positions=floats(frames*moving*3);
  at+=frames*12;const control=floats(frames*3);const summary=floats(8);
  const mask=view.getBigUint64(at,true),movingBones=[];
  for(let bone=0;bone<64;bone++)if(mask&(1n<<BigInt(bone)))movingBones.push(bone);
  if(movingBones.length!==moving||movingBones.some(bone=>bone>=bones))throw new Error('Animation position mask does not match its tracks');
  for(let i=0;i<rotations.length;i+=4){const n=Math.hypot(...rotations.subarray(i,i+4));if(n<.5||n>1.5)throw new Error('Invalid animation quaternion');}
  return {frames,bones,moving,movingBones,rotations,positions,control,summary,fps:20,duration:(frames-1)/20};
}

const unitScale=new THREE.Vector3(1,1,1);
export class NativeRig {
  constructor(spec) {
    if(!spec||!spec.bones?.length||spec.bones.length>256)throw new Error('Invalid skeleton');
    this.bones=spec.bones;this.names=new Map(this.bones.map((b,i)=>[b.name.toLowerCase(),i]));
    this.world=[];this.skin=[];this.inverse=[];this.bindPositions=[];
    for(let i=0;i<this.bones.length;i++){
      const bone=this.bones[i];if(bone.parent>=i||bone.parent < -1||bone.pivot.length!==3||bone.pivot.some(n=>!Number.isFinite(n)))throw new Error('Invalid skeleton hierarchy');
      const pivot=new THREE.Vector3(bone.pivot[0],bone.pivot[1],-bone.pivot[2]);
      if(bone.parent>=0)pivot.add(this.bindPositions[bone.parent]);this.bindPositions.push(pivot);
      this.inverse.push(new THREE.Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z));
      this.world.push(new THREE.Matrix4());this.skin.push(new THREE.Matrix4());
    }
    this.q=new THREE.Quaternion();this.nextQ=new THREE.Quaternion();this.position=new THREE.Vector3();this.local=new THREE.Matrix4();
  }
  pose(clip,time,parentWorld=null) {
    if(clip.bones!==this.bones.length)throw new Error('Animation and skeleton bone counts differ');
    const frame=clip.duration?((time%clip.duration)+clip.duration)%clip.duration*clip.fps:0;
    const f0=Math.floor(frame),f1=Math.min(f0+1,clip.frames-1),mix=frame-f0;
    for(let i=0;i<this.bones.length;i++){
      const bone=this.bones[i],a=(f0*clip.bones+i)*4,b=(f1*clip.bones+i)*4;
      this.q.set(-clip.rotations[a],-clip.rotations[a+1],clip.rotations[a+2],clip.rotations[a+3]).normalize();
      this.nextQ.set(-clip.rotations[b],-clip.rotations[b+1],clip.rotations[b+2],clip.rotations[b+3]).normalize();this.q.slerp(this.nextQ,mix);
      this.position.set(bone.pivot[0],bone.pivot[1],-bone.pivot[2]);
      const index=clip.movingBones.indexOf(i);
      if(index>=0){
        const pos0=(f0*clip.moving+index)*3,pos1=(f1*clip.moving+index)*3;
        this.position.set(THREE.MathUtils.lerp(clip.positions[pos0],clip.positions[pos1],mix),THREE.MathUtils.lerp(clip.positions[pos0+1],clip.positions[pos1+1],mix),-THREE.MathUtils.lerp(clip.positions[pos0+2],clip.positions[pos1+2],mix));
      }
      if(i===0&&!parentWorld){
        const a=f0*3,b=f1*3;
        // Play clips in place; formation translation is handled separately.
        this.position.set(THREE.MathUtils.lerp(clip.control[a],clip.control[b],mix)-clip.control[0],THREE.MathUtils.lerp(clip.control[a+1],clip.control[b+1],mix),-(THREE.MathUtils.lerp(clip.control[a+2],clip.control[b+2],mix)-clip.control[2]));
      }
      this.local.compose(this.position,this.q,unitScale);
      if(i===0&&parentWorld)this.world[i].copy(parentWorld);
      else if(bone.parent>=0)this.world[i].multiplyMatrices(this.world[bone.parent],this.local);
      else this.world[i].copy(this.local);
      this.skin[i].multiplyMatrices(this.world[i],this.inverse[i]);
    }
    return frame;
  }
}

export function makeSkinMap(model,rig,attachments=[]) {
  const bySlot=new Map();
  for(const bone of model.bones){
    for(const candidate of [rig,...attachments]){
      const index=candidate.names.get(bone.name.toLowerCase());
      if(index!==undefined)bySlot.set(bone.slot,{rig:candidate,index});
    }
  }
  return Array.from({length:256},(_,i)=>bySlot.get(i)??{rig,index:0});
}

export function skinVertices(model,map,positions,normals) {
  const source=model.attributes[0],sourceNormals=model.attributes[3],indices=model.attributes[2],weights=model.attributes[1];
  if(!indices||!weights)throw new Error('This mesh has no skinning streams');
  for(let v=0;v<model.vertexCount;v++){
    const at=v*3,w=weights[v*2]+weights[v*2+1];
    const first=w>0?weights[v*2]/w:1,second=w>0?weights[v*2+1]/w:0;
    const a=map[indices[v*4+2]],b=map[indices[v*4+1]],m=a.rig.skin[a.index].elements,n=b.rig.skin[b.index].elements;
    const x=source[at],y=source[at+1],z=-source[at+2];
    for(let axis=0;axis<3;axis++)positions[at+axis]=(m[axis]*x+m[axis+4]*y+m[axis+8]*z+m[axis+12])*first+(n[axis]*x+n[axis+4]*y+n[axis+8]*z+n[axis+12])*second;
    if(normals&&sourceNormals){const x=sourceNormals[at],y=sourceNormals[at+1],z=-sourceNormals[at+2];for(let axis=0;axis<3;axis++)normals[at+axis]=(m[axis]*x+m[axis+4]*y+m[axis+8]*z)*first+(n[axis]*x+n[axis+4]*y+n[axis+8]*z)*second;const length=Math.hypot(normals[at],normals[at+1],normals[at+2])||1;for(let axis=0;axis<3;axis++)normals[at+axis]/=length;}
  }
}
