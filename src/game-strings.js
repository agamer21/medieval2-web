export function parseGameStrings(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);if(bytes.length<8)throw new Error('Truncated game string table');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),count=view.getUint32(4,true);if(!count||count>100000)throw new Error('Invalid game string count');
 const decoder=new TextDecoder('utf-16le'),strings=new Map();let at=8;
 const read=()=>{if(at+2>bytes.length)throw new Error('Truncated game string length');const size=view.getUint16(at,true);at+=2;if(size>16384||at+size*2>bytes.length)throw new Error('Invalid game string range');const value=decoder.decode(bytes.subarray(at,at+size*2));at+=size*2;return value;};
 for(let i=0;i<count;i++){const key=read(),value=read();if(!key||strings.has(key))throw new Error('Invalid or duplicate game string key');strings.set(key,value);}
 if(bytes.length-at>4||bytes.subarray(at).some(value=>value!==0))throw new Error('Unexpected game string table tail');return strings;
}
