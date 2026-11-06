import {openRemoteGameFiles} from './pack.js';
import {decodeTga} from './tga.js';
import {parseGameStrings} from './game-strings.js';

const canvas=document.getElementById('menu-art'),ctx=canvas.getContext('2d'),status=document.getElementById('menu-status'),fallback=document.getElementById('play-fallback');
let background=null,strings=new Map(),screen='main',hover=-1,notice='';
const mainKeys=['UI_MAIN_MENU_SINGLE_PLAYER','UI_MAIN_MENU_MULTIPLAYER','UI_MAIN_MENU_LOAD_GAME','UI_MAIN_MENU_OPTIONS','UI_MAIN_MENU_CREDITS','UI_MAIN_MENU_QUIT'];
const newGameKeys=['UI_NEW_GAME_PROLOGUE','UI_NEW_GAME_IMPERIAL_CAMPAIGN','UI_NEW_GAME_PROVINCIAL_CAMPAIGN','UI_NEW_GAME_HISTORICAL_BATTLE','UI_NEW_GAME_HISTORICAL_CAMPAIGNS','UI_NEW_GAME_CUSTOM_BATTLE','UI_NEW_GAME_QUICK_BATTLE'];
function options(){return screen==='main'?mainKeys:newGameKeys;}
function label(key){return strings.get(key)??key;}
function draw(){
 const scale=devicePixelRatio>1?2:1,w=innerWidth,h=innerHeight;canvas.width=Math.floor(w*scale);canvas.height=Math.floor(h*scale);ctx.setTransform(w/1024*scale,0,0,h/768*scale,0,0);ctx.drawImage(background,0,0,1024,768);
 const items=options(),firstY=screen==='main'?196:175,rowHeight=screen==='main'?55:48;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 17px Georgia,serif';
 for(let i=0;i<items.length;i++){const y=firstY+i*rowHeight+27.5;if(i===hover){ctx.fillStyle='#d4b86b2a';ctx.fillRect(52,firstY+i*rowHeight+2,373,rowHeight-4);}ctx.shadowColor='#000';ctx.shadowBlur=3;ctx.fillStyle=i===hover?'#fff1bd':'#e4d9ae';ctx.fillText(label(items[i]),239,y,340);}
 ctx.shadowBlur=0;
 if(notice){ctx.fillStyle='#0b0b0be6';ctx.fillRect(493,605,500,67);ctx.strokeStyle='#bba66d';ctx.strokeRect(493,605,500,67);ctx.font='16px Georgia,serif';ctx.fillStyle='#efe5c4';ctx.textAlign='left';ctx.fillText(notice,510,638,465);ctx.font='12px Arial';ctx.fillText('Click anywhere to return',510,658);}
}
function position(event){const r=canvas.getBoundingClientRect();return{x:(event.clientX-r.left)/r.width*1024,y:(event.clientY-r.top)/r.height*768};}
function hit(event){const p=position(event),index=Math.floor((p.y-(screen==='main'?196:175))/(screen==='main'?55:48));return p.x>=45&&p.x<=435&&index>=0&&index<options().length?index:-1;}
canvas.addEventListener('pointermove',e=>{const next=hit(e);if(next!==hover){hover=next;canvas.style.cursor=next<0?'default':'pointer';draw();}});
canvas.addEventListener('pointerleave',()=>{hover=-1;canvas.style.cursor='default';draw();});
canvas.addEventListener('click',e=>{
 if(notice){notice='';draw();return;}const index=hit(e);if(index<0)return;const key=options()[index];
 if(screen==='main'&&key==='UI_MAIN_MENU_SINGLE_PLAYER'){screen='single';hover=-1;draw();return;}
 if(screen==='single'&&key==='UI_NEW_GAME_CUSTOM_BATTLE'){location.href='./';return;}
 if(screen==='single'&&key==='UI_NEW_GAME_IMPERIAL_CAMPAIGN')notice='Campaign map and turn systems are still being ported.';
 else if(screen==='single'&&key==='UI_NEW_GAME_PROLOGUE')notice='The original prologue is not connected yet.';
 else if(screen==='single'&&key==='UI_NEW_GAME_HISTORICAL_BATTLE')notice='Historical battle scenarios are still being ported.';
 else if(screen==='single'&&key==='UI_NEW_GAME_HISTORICAL_CAMPAIGNS')notice='Historical campaigns are still being ported.';
 else if(screen==='single'&&key==='UI_NEW_GAME_PROVINCIAL_CAMPAIGN')notice='This campaign mode is not connected yet.';
 else notice=`${label(key)} is not connected yet.`;
 draw();
});
addEventListener('keydown',e=>{if(e.key==='Escape'&&screen==='single'){screen='main';notice='';draw();}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();hover=(hover+(e.key==='ArrowDown'?1:options().length-1))%options().length;draw();}else if(e.key==='Enter'&&hover>=0){const row=hover,y=(screen==='main'?196:175)+row*(screen==='main'?55:48)+27.5;canvas.dispatchEvent(new MouseEvent('click',{clientX:canvas.getBoundingClientRect().left+239/1024*canvas.clientWidth,clientY:canvas.getBoundingClientRect().top+y/768*canvas.clientHeight,bubbles:true}));}});
async function initialize(){
 try{
  status.textContent='Reading the installed game locally…';const response=await fetch('./api/game',{cache:'no-store'});if(!response.ok)throw new Error('No local game was detected.');const manifest=await response.json();if(!manifest.available)throw new Error('No local game was detected.');
  const reader=await openRemoteGameFiles(manifest),[menu,table]=await Promise.all([reader.read('data/menu/_m2_main_menu.tga'),reader.read('data/text/menu_english.txt.strings.bin')]);
  background=decodeTga(menu);strings=parseGameStrings(table);screen='main';status.hidden=true;fallback.hidden=true;draw();window.originalMenu={reader,strings,get screen(){return screen;}};
 }catch(error){status.textContent=error.message;fallback.hidden=false;}
}
initialize();
