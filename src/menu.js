import {connectInstalledGame, installedGame} from './installed-game.js';
import {decodeTga} from './tga.js';
import {parseGameStrings} from './game-strings.js';

const canvas=document.getElementById('menu-art'),ctx=canvas.getContext('2d'),status=document.getElementById('menu-status');
let background=null,singlePanels=null,prologuePicture=null,strings=new Map(),screen='main',hover=-1,notice='';
const back = document.getElementById('menu-back');
const connect = document.getElementById('connect-installation');
const english = ['Single Player','Multiplayer','Load Game','Options','Credits','Quit',
 'Prologue','Imperial Campaign','Provincial Campaign','Historical Battle',
 'Historical Campaigns','Custom Battle','Quick Battle'];
function showScreen(next) {
 screen = next;
 hover = -1;
 notice = '';
 back.hidden = next === 'main';
 draw();
}
back.onclick = () => showScreen('main');
const mainKeys=['UI_MAIN_MENU_SINGLE_PLAYER','UI_MAIN_MENU_MULTIPLAYER','UI_MAIN_MENU_LOAD_GAME','UI_MAIN_MENU_OPTIONS','UI_MAIN_MENU_CREDITS','UI_MAIN_MENU_QUIT'];
const newGameKeys=['UI_NEW_GAME_PROLOGUE','UI_NEW_GAME_IMPERIAL_CAMPAIGN','UI_NEW_GAME_PROVINCIAL_CAMPAIGN','UI_NEW_GAME_HISTORICAL_BATTLE','UI_NEW_GAME_HISTORICAL_CAMPAIGNS','UI_NEW_GAME_CUSTOM_BATTLE','UI_NEW_GAME_QUICK_BATTLE'];
function options(){return screen==='main'?mainKeys:newGameKeys;}
function label(key){return strings.get(key)??english[[...mainKeys,...newGameKeys].indexOf(key)]??key;}
function draw(){
 const scale=devicePixelRatio>1?2:1,w=innerWidth,h=innerHeight;canvas.width=Math.floor(w*scale);canvas.height=Math.floor(h*scale);ctx.setTransform(w/1024*scale,0,0,h/768*scale,0,0);
 if (background) ctx.drawImage(background,0,0,1024,768);
 else {
  const gradient = ctx.createLinearGradient(0,0,1024,768);
  gradient.addColorStop(0,'#16251f');gradient.addColorStop(1,'#09120f');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,768);
  ctx.fillStyle='#eddaa6';ctx.textAlign='center';ctx.font='46px Georgia,serif';
  ctx.fillText('MEDIEVAL II',512,111);
  ctx.font='16px Georgia,serif';ctx.fillText('NORMAN PROLOGUE',512,145);
 }
 const items=options(),firstY=screen==='main'?196:175,rowHeight=screen==='main'?55:48;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 17px Georgia,serif';
 if (screen === 'single' && singlePanels) {
  ctx.fillStyle = '#0b0c09';
  ctx.fillRect(42, 180, 940, 399);
  for (let i = 0; i < items.length; i++) {
   ctx.drawImage(singlePanels, 0, 3, 404, 54, 42, firstY + i * rowHeight + 3, 394, rowHeight);
  }
  if (hover <= 0) ctx.drawImage(prologuePicture, 513, 195, 426, 290);
 }
 if (!background) {
  for (let i=0;i<items.length;i++) {
   ctx.fillStyle='#263830';ctx.fillRect(52,firstY+i*rowHeight+5,373,rowHeight-9);
   ctx.strokeStyle='#86784f';ctx.strokeRect(52,firstY+i*rowHeight+5,373,rowHeight-9);
  }
 }
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
 if(screen==='main'&&key==='UI_MAIN_MENU_SINGLE_PLAYER'){showScreen('single');return;}
 if(screen==='single'&&key==='UI_NEW_GAME_CUSTOM_BATTLE'){location.href='./';return;}
 if(screen==='single'&&key==='UI_NEW_GAME_IMPERIAL_CAMPAIGN')notice='Campaign map and turn systems are still being ported.';
 else if(screen==='single'&&key==='UI_NEW_GAME_PROLOGUE'){location.href='prologue.html';return;}
 else if(screen==='single'&&key==='UI_NEW_GAME_HISTORICAL_BATTLE')notice='Historical battle scenarios are still being ported.';
 else if(screen==='single'&&key==='UI_NEW_GAME_HISTORICAL_CAMPAIGNS')notice='Historical campaigns are still being ported.';
 else if(screen==='single'&&key==='UI_NEW_GAME_PROVINCIAL_CAMPAIGN')notice='This campaign mode is not connected yet.';
 else notice=`${label(key)} is not connected yet.`;
 draw();
});
addEventListener('keydown',e=>{if(e.key==='Escape'&&screen==='single'){showScreen('main');}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();hover=hover<0?(e.key==='ArrowDown'?0:options().length-1):(hover+(e.key==='ArrowDown'?1:options().length-1))%options().length;draw();}else if(e.key==='Enter'&&hover>=0&&e.target!==back){const row=hover,y=(screen==='main'?196:175)+row*(screen==='main'?55:48)+27.5;canvas.dispatchEvent(new MouseEvent('click',{clientX:canvas.getBoundingClientRect().left+239/1024*canvas.clientWidth,clientY:canvas.getBoundingClientRect().top+y/768*canvas.clientHeight,bubbles:true}));}});
async function loadOriginalMenu(reader){
  const [menu,table,panels,picture]=await Promise.all([
   reader.read('data/menu/_m2_main_menu.tga'),reader.read('data/text/menu_english.txt.strings.bin'),
   reader.read('data/menu/_m2_single_player_panels.tga'),reader.read('data/menu/textures/prologue_pic.tga')
  ]);
  background=decodeTga(menu);singlePanels=decodeTga(panels);prologuePicture=decodeTga(picture);
  strings=parseGameStrings(table);status.hidden=true;connect.hidden=true;draw();window.originalMenu={reader,strings,get screen(){return screen;}};
}
draw();
connect.hidden = typeof window.showDirectoryPicker !== 'function';
installedGame().then(reader=>reader&&loadOriginalMenu(reader)).catch(error=>{
 status.hidden=false;status.textContent=error.message;
});
connect.onclick=async()=>{
 try {
  await loadOriginalMenu(await connectInstalledGame());
 } catch(error) {
  if (error.name==='AbortError') return;
  status.hidden=false;status.textContent=error.message;
 }
};
addEventListener('resize',draw);
