import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeTgaPixels,TgaFormatError} from '../src/tga.js';
import {parseGameStrings} from '../src/game-strings.js';

function tga(width,height,depth,type,descriptor,pixels){const bytes=new Uint8Array(18+pixels.length);bytes[2]=type;const view=new DataView(bytes.buffer);view.setUint16(12,width,true);view.setUint16(14,height,true);bytes[16]=depth;bytes[17]=descriptor;bytes.set(pixels,18);return bytes;}
test('TGA decoder respects bottom-left origin and BGRA channel order',()=>{
 const bytes=tga(2,2,24,2,0,[0,0,255,0,255,0,255,0,0,255,255,255]),{width,height,pixels}=decodeTgaPixels(bytes);
 assert.equal(width,2);assert.equal(height,2);assert.deepEqual([...pixels],[0,0,255,255,255,255,255,255,255,0,0,255,0,255,0,255]);
});
test('TGA decoder expands RLE packets and preserves alpha',()=>{
 const {pixels}=decodeTgaPixels(tga(1,2,32,10,0x28,[0x81,30,20,10,40]));assert.deepEqual([...pixels],[10,20,30,40,10,20,30,40]);
});
test('invalid TGA encodings fail with a bounded format error',()=>assert.throws(()=>decodeTgaPixels(new Uint8Array(4)),TgaFormatError));
test('game string table decodes UTF-16LE key/value pairs',()=>{
 const enc=value=>{const text=Buffer.from(value,'utf16le'),out=new Uint8Array(2+text.length);new DataView(out.buffer).setUint16(0,value.length,true);out.set(text,2);return out;};
 const rows=[['UI_MAIN_MENU_SINGLE_PLAYER','Single Player'],['UI_MAIN_MENU_QUIT','Quit']].flatMap(pair=>pair.map(enc)),bytes=new Uint8Array(8+rows.reduce((sum,row)=>sum+row.length,0)+4),view=new DataView(bytes.buffer);view.setUint32(4,2,true);let at=8;for(const row of rows){bytes.set(row,at);at+=row.length;}
 const strings=parseGameStrings(bytes);assert.equal(strings.size,2);assert.equal(strings.get('UI_MAIN_MENU_SINGLE_PLAYER'),'Single Player');assert.equal(strings.get('UI_MAIN_MENU_QUIT'),'Quit');
});
test('invalid game string records are rejected',()=>assert.throws(()=>parseGameStrings(new Uint8Array(8)),/count/));
