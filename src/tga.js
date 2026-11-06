export class TgaFormatError extends Error {}

export function decodeTgaPixels(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);if(bytes.length<18)throw new TgaFormatError('Truncated TGA header');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),idLength=bytes[0],colourMap=bytes[1],type=bytes[2],width=view.getUint16(12,true),height=view.getUint16(14,true),depth=bytes[16],descriptor=bytes[17];
 if(colourMap!==0||![2,3,10,11].includes(type)||!width||!height||width*height>16_777_216||![8,24,32].includes(depth)||(type===3||type===11)&&depth!==8)throw new TgaFormatError('Unsupported TGA layout');
 const pixelBytes=depth>>3,offset=18+idLength;if(offset>bytes.length)throw new TgaFormatError('Truncated TGA image ID');
 const total=width*height,out=new Uint8ClampedArray(total*4);let at=offset,index=0;
 function pixel(){if(at+pixelBytes>bytes.length)throw new TgaFormatError('Truncated TGA pixels');let r,g,b,a=255;if(depth===8)r=g=b=bytes[at++];else{b=bytes[at++];g=bytes[at++];r=bytes[at++];if(depth===32)a=bytes[at++];}return [r,g,b,a];}
 function write(colour){const rawY=Math.floor(index/width),rawX=index%width,y=descriptor&0x20?rawY:height-1-rawY,x=descriptor&0x10?width-1-rawX:rawX,p=(y*width+x)*4;out.set(colour,p);index++;}
 while(index<total){let count=1,repeated=false;if(type===10||type===11){if(at>=bytes.length)throw new TgaFormatError('Truncated TGA RLE packet');const header=bytes[at++];count=(header&0x7f)+1;repeated=(header&0x80)!==0;if(index+count>total)throw new TgaFormatError('TGA RLE packet exceeds image');}
  if(repeated){const colour=pixel();for(let i=0;i<count;i++)write(colour);}else for(let i=0;i<count;i++)write(pixel());
 }
 return {width,height,pixels:out};
}
export function decodeTga(input){const {width,height,pixels}=decodeTgaPixels(input),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').putImageData(new ImageData(pixels,width,height),0,0);return canvas;}
