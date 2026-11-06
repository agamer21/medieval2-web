// Decode the first mip of the DDS image embedded in a Medieval II .texture file.
export function decodeTexture(input) {
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const four=(at)=>String.fromCharCode(...bytes.subarray(at,at+4));
  let base=0;
  if(four(0)!=='DDS '){
    if(bytes.length<12)throw new Error('Texture header is truncated');
    base=view.getUint32(4,true);
    if(base>4096||base+128>bytes.length||four(base)!=='DDS ')throw new Error('Expected DDS or Medieval II .texture data');
  }
  if(base+128>bytes.length||view.getUint32(base+4,true)!==124)throw new Error('Invalid DDS header');
  const height=view.getUint32(base+12,true),width=view.getUint32(base+16,true),format=four(base+84);
  if(!width||!height||width>8192||height>8192||width*height>16_777_216)throw new Error('Texture dimensions are unsupported');
  if(!['DXT1','DXT3','DXT5'].includes(format))throw new Error(`DDS format ${format} is not supported yet`);
  const blockSize=format==='DXT1'?8:16,bw=Math.ceil(width/4),bh=Math.ceil(height/4);
  if(base+128+bw*bh*blockSize>bytes.length)throw new Error('Texture pixel data is truncated');
  const pixels=new Uint8ClampedArray(width*height*4);
  const rgb=value=>[(value>>11&31)*255/31,(value>>5&63)*255/63,(value&31)*255/31];
  let at=base+128;
  for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++,at+=blockSize){
    const colorAt=at+(format==='DXT1'?0:8),c0=view.getUint16(colorAt,true),c1=view.getUint16(colorAt+2,true);
    const palette=[rgb(c0),rgb(c1)];
    if(format!=='DXT1'||c0>c1){palette.push(palette[0].map((n,k)=>(2*n+palette[1][k])/3),palette[0].map((n,k)=>(n+2*palette[1][k])/3));}
    else palette.push(palette[0].map((n,k)=>(n+palette[1][k])/2),[0,0,0]);
    const indices=view.getUint32(colorAt+4,true),alpha=[];
    if(format==='DXT5'){
      alpha.push(bytes[at],bytes[at+1]);
      if(alpha[0]>alpha[1])for(let n=1;n<=6;n++)alpha.push(((7-n)*alpha[0]+n*alpha[1])/7);
      else{for(let n=1;n<=4;n++)alpha.push(((5-n)*alpha[0]+n*alpha[1])/5);alpha.push(0,255);}
    }
    for(let p=0;p<16;p++){
      const x=bx*4+(p&3),y=by*4+(p>>2);if(x>=width||y>=height)continue;
      const index=indices>>>(p*2)&3,target=(y*width+x)*4;
      pixels.set(palette[index],target);
      let a=255;
      if(format==='DXT1'&&c0<=c1&&index===3)a=0;
      if(format==='DXT3')a=(bytes[at+(p>>1)]>>((p&1)*4)&15)*17;
      if(format==='DXT5'){const bit=p*3,byte=at+2+(bit>>3);a=alpha[((bytes[byte]|(bytes[byte+1]??0)<<8)>>>(bit&7))&7];}
      pixels[target+3]=a;
    }
  }
  return {width,height,pixels,format,ddsOffset:base};
}
export function textureAtlas(main, attachment=main) {
  // The engine's UVs address a side-by-side main/attachment pair.
  const canvas=document.createElement('canvas');canvas.width=main.width*2;canvas.height=main.height;
  const context=canvas.getContext('2d');
  for(const [image,x] of [[main,0],[attachment,main.width]]){
    const temp=document.createElement('canvas');temp.width=image.width;temp.height=image.height;
    temp.getContext('2d').putImageData(new ImageData(image.pixels,image.width,image.height),0,0);
    context.drawImage(temp,x,0,main.width,main.height);
  }
  return canvas;
}
