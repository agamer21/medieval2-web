// Original implementation of the observed Medieval II Boost archive layout.
// Geometry and stream boundaries are validated against the closing bone table.
const SIGNATURE = 'serialization::archive';
const STRIDES = new Map([[0,[12]],[1,[8]],[2,[4]],[3,[4,12]],[4,[8]],
  [8,[4]],[9,[4]],[10,[4,12]],[11,[4,12]],[13,[4]],[14,[4]]]);
export class MeshFormatError extends Error {}
class Cursor {
  constructor(buffer, offset=0) { this.bytes = new Uint8Array(buffer); this.view = new DataView(buffer); this.at = offset; this.classes = new Set(); }
  need(n) { if (!Number.isSafeInteger(n) || n < 0 || this.at+n>this.bytes.length) throw new MeshFormatError(`Truncated model at byte ${this.at}`); }
  u8() { this.need(1); return this.bytes[this.at++]; }
  u16() { this.need(2); const n=this.view.getUint16(this.at,true); this.at+=2; return n; }
  u32() { this.need(4); const n=this.view.getUint32(this.at,true); this.at+=4; return n; }
  float() { this.need(4); const n=this.view.getFloat32(this.at,true); this.at+=4; if(!Number.isFinite(n))throw new MeshFormatError('Nonfinite coordinate'); return n; }
  count(max=4_000_000) { const n=this.u32(); if(n>max)throw new MeshFormatError(`Invalid count ${n} at ${this.at-4}`); return n; }
  text() { const n=this.count(16384); this.need(n); const s=new TextDecoder('windows-1252').decode(this.bytes.subarray(this.at,this.at+n)); this.at+=n; return s; }
  skip(n) { this.need(n); this.at+=n; }
  reference(track=true) {
    for(let zeroes=0;;zeroes++){if(zeroes>64)throw new MeshFormatError('Invalid archive reference'); this.need(2); if(this.view.getUint16(this.at,true)!==0)break;this.at+=2;}
    const type=this.u16();
    if(track&&!this.classes.has(type)){this.classes.add(type);this.skip(2);}
    this.skip(4); return type;
  }
}
function descriptor(r, at) {
  return at+8<=r.bytes.length && r.view.getUint16(at,true)===0 &&
    r.view.getUint16(at+2,true)>0 && r.view.getUint16(at+2,true)<=64 && r.bytes[at+4]<=1 && r.bytes[at+5]<=8;
}
function closeGeometry(buffer, offset) {
  const r=new Cursor(buffer,offset); r.reference(false); r.reference(false); r.skip(10);
  const sphere=Array.from({length:4},()=>r.float());
  if(sphere[3]<0||sphere[3]>100000)throw new MeshFormatError('Invalid bounding sphere');
  r.u32(); const count=r.count(4096); if(count)r.u16();
  const bones=[]; for(let i=0;i<count;i++){const name=r.text();if(!/^[\x20-\x7e]{1,160}$/.test(name))throw new MeshFormatError('Invalid bone name');bones.push({name,slot:r.u32()});}
  if(r.bytes.length-r.at>8192)throw new MeshFormatError('Unrecognized model trailer');
  return {bones,sphere,geometryEnd:r.at,trailingBytes:r.bytes.length-r.at};
}
function readStreams(buffer, offset, vertexCount) {
  const view=new DataView(buffer); let attempts=0;
  function visit(at, streams) {
    if(++attempts>20000)throw new MeshFormatError('Archive is too ambiguous');
    // A closing table is accepted only after positions and UVs have been found.
    if(streams.has(0)&&streams.has(4)) {
      try { return {streams,...closeGeometry(buffer,at)}; } catch(error) { if(!(error instanceof MeshFormatError))throw error; }
    }
    const limit=Math.min(at+96,buffer.byteLength-10);
    for(let pos=at;pos<=limit;pos+=2){
      const type=view.getUint32(pos,true); if(!STRIDES.has(type)||streams.has(type))continue;
      for(const gap of [4,6]){
        if(view.getUint32(pos+gap,true)!==vertexCount)continue;
        const start=pos+gap+4;
        for(const stride of STRIDES.get(type)){
          const end=start+stride*vertexCount;if(end>buffer.byteLength)continue;
          const next=new Map(streams);next.set(type,{start,stride});
          const result=visit(end,next);if(result)return result;
        }
      }
    }
    return null;
  }
  const result=visit(offset,new Map());if(!result)throw new MeshFormatError('Vertex streams do not lead to a valid bone table');return result;
}
export function parseMesh(input) {
  const buffer=input instanceof ArrayBuffer?input:input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength);
  if(buffer.byteLength>64*1024*1024)throw new MeshFormatError('Model exceeds the 64 MiB limit');
  const r=new Cursor(buffer);if(r.text()!==SIGNATURE)throw new MeshFormatError('Expected a Medieval II .mesh Boost archive');
  r.skip(5);const header=r.at;let found=false;
  for(const words of [4,3]){if(descriptor(r,header+words*4)){r.at=header+words*4;found=true;break;}}
  if(!found)throw new MeshFormatError('Unsupported archive header');
  r.u16();r.reference();r.u16();r.reference();r.u16();
  const groupCount=r.count(4096),groups=[];
  for(let i=0;i<groupCount;i++){
    r.reference();const category=r.text(),name=r.text();if(i===0)r.u16();
    const triangles=r.count(1_000_000),indices=new Uint16Array(triangles*3);
    for(let j=0;j<indices.length;j++)indices[j]=r.u16();
    const optional=r.u32();if(optional>1)throw new MeshFormatError('Invalid group visibility flag');
    const tag=r.u8();r.reference();r.reference();groups.push({category,name,indices,optional,tag});
  }
  r.reference();r.reference();const vertexCount=r.count(65536);if(!vertexCount)throw new MeshFormatError('Empty vertex pool');r.u16();const influences=r.u32();
  const decoded=readStreams(buffer,r.at,vertexCount),attributes={};
  for(const [type,{start,stride}] of decoded.streams){
    const raw=new Uint8Array(buffer,start,vertexCount*stride);
    if([0,1,4].includes(type)||([3,10,11].includes(type)&&stride===12)){
      const array=new Float32Array(raw.byteLength/4);const data=new DataView(buffer,start,raw.byteLength);
      for(let j=0;j<array.length;j++){array[j]=data.getFloat32(j*4,true);if(!Number.isFinite(array[j]))throw new MeshFormatError('Nonfinite vertex attribute');}
      attributes[type]=array;
    }else if([3,10,11].includes(type)){
      const array=new Float32Array(vertexCount*3);for(let j=0;j<vertexCount;j++)for(let c=0;c<3;c++)array[j*3+c]=raw[j*4+2-c]/127.5-1;attributes[type]=array;
    }else attributes[type]=raw.slice();
  }
  for(const g of groups)for(const index of g.indices)if(index>=vertexCount)throw new MeshFormatError(`Group ${g.name} references missing vertex ${index}`);
  const xyz=attributes[0],bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(let i=0;i<xyz.length;i++) { const a=i%3;bounds.min[a]=Math.min(bounds.min[a],xyz[i]);bounds.max[a]=Math.max(bounds.max[a],xyz[i]); }
  if(bounds.max.some((n,i)=>n-bounds.min[i]>100000))throw new MeshFormatError('Implausible model dimensions');
  return {vertexCount,groups,attributes,bounds,influences,bones:decoded.bones,sphere:decoded.sphere,
    trailingBytes:decoded.trailingBytes,bytes:buffer.byteLength,streamTypes:[...decoded.streams.keys()]};
}
