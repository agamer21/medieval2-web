import * as THREE from 'three';
import {OrbitControls} from '../vendor/three/OrbitControls.js';
import {createBattle,stepBattle,select,command,rally,TYPES,living,fighting} from './battle-sim.js';
const $=id=>document.getElementById(id),canvas=$('battle-canvas'),host=$('battlefield');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){$('loading-error').hidden=false;throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
const scene=new THREE.Scene();scene.background=new THREE.Color('#aab8ab');scene.fog=new THREE.Fog('#aab8ab',130,265);
const camera=new THREE.PerspectiveCamera(43,1,.1,500);camera.position.set(48,70,85);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,0,3);controls.enableDamping=true;controls.dampingFactor=.09;controls.maxPolarAngle=1.25;controls.minPolarAngle=.3;controls.minDistance=22;controls.maxDistance=160;controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:null};controls.update();
function frameBattle(){const compact=host.clientWidth<600;camera.fov=compact?54:43;controls.maxDistance=compact?220:160;camera.position.set(...(compact?[12,122,114]:[48,70,85]));controls.target.set(0,0,3);camera.updateProjectionMatrix();controls.update();}
scene.add(new THREE.HemisphereLight('#f8f2d6','#66744d',2.8));
const sun=new THREE.DirectionalLight('#fff0cf',3.3);sun.position.set(-45,75,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:1,far:180});sun.shadow.bias=-.0005;sun.shadow.normalBias=.04;scene.add(sun);
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.88,...extra});
const materials={blue:mat('#315c77'),red:mat('#944b3b'),steel:mat('#a8aaa0',{metalness:.45,roughness:.5}),skin:mat('#c7a27c'),wood:mat('#66533b'),boots:mat('#3d4032'),bow:mat('#aa8958'),gold:mat('#d6ba78'),horse:mat('#5d4632'),horseDark:mat('#42321f')};
function mesh(geometry,material,x,y,z,scale=null){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);if(scale)m.scale.set(...scale);m.receiveShadow=true;scene.add(m);return m;}
// All scenery and soldiers are authored procedurally; no original game data is fetched.
let seed=127;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const texCanvas=document.createElement('canvas');texCanvas.width=texCanvas.height=128;const tc=texCanvas.getContext('2d');tc.fillStyle='#89976a';tc.fillRect(0,0,128,128);for(let i=0;i<2400;i++){tc.fillStyle=random()>.5?'#849265':'#93a074';tc.fillRect(random()*128,random()*128,1+random()*3,1+random()*3);}const grass=new THREE.CanvasTexture(texCanvas);grass.colorSpace=THREE.SRGBColorSpace;grass.wrapS=grass.wrapT=THREE.RepeatWrapping;grass.repeat.set(45,45);
const ground=mesh(new THREE.PlaneGeometry(650,650),mat('#b8bd88',{map:grass}),0,-.03,0);ground.rotation.x=-Math.PI/2;
const road=mesh(new THREE.PlaneGeometry(8,135),mat('#b1aa85'),-2,.002,0);road.rotation.x=-Math.PI/2;road.rotation.z=-.18;
const water=mesh(new THREE.PlaneGeometry(115,2.7),mat('#779b92',{metalness:.3,roughness:.25}),0,.009,0);water.rotation.x=-Math.PI/2;water.rotation.z=-.07;
const stoneMat=mat('#9a9b86'),hillMat=mat('#758861');
for(let i=0;i<24;i++){const x=(random()-.5)*14,z=(random()-.5)*3.5;const stone=mesh(new THREE.DodecahedronGeometry(.3+random()*.5,0),stoneMat,x,.09,z);stone.scale.y=.25;}
for(let i=0;i<15;i++){const a=i/15*Math.PI*2;mesh(new THREE.SphereGeometry(1,12,8),hillMat,Math.cos(a)*135,-5,Math.sin(a)*135,[20+random()*30,13+random()*15,25+random()*20]);}
const treeTrunk=mat('#655c43'),treeLeaf=mat('#405d44');
for(let i=0;i<85;i++){let x=(random()-.5)*210,z=(random()-.5)*190;if(Math.abs(x)<55&&Math.abs(z)<51){x=Math.sign(x||1)*(58+random()*28);}const h=3+random()*4;mesh(new THREE.CylinderGeometry(.23,.4,h,5),treeTrunk,x,h/2,z).castShadow=true;const crown=mesh(new THREE.ConeGeometry(2+random(),h*1.7,7),treeLeaf,x,h*1.1,z);crown.castShadow=true;}
// A distant gate and watchtowers provide orientation, outside the playable field.
mesh(new THREE.BoxGeometry(26,7,3),stoneMat,-8,3.5,-73);
for(const x of [-23,7]){mesh(new THREE.CylinderGeometry(3,3.8,13,8),stoneMat,x,6.5,-73).castShadow=true;mesh(new THREE.ConeGeometry(4,5,8),materials.red,x,15,-73);}
const boundary=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-47,.03,-43),new THREE.Vector3(47,.03,-43),new THREE.Vector3(47,.03,43),new THREE.Vector3(-47,.03,43)]),new THREE.LineBasicMaterial({color:'#e0d6a3',transparent:true,opacity:.35}));scene.add(boundary);
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),dummy=new THREE.Object3D(),v=new THREE.Vector3();
let battle=createBattle(),speed=1,elapsed=0,accumulator=0,lastFrame=performance.now(),hudElapsed=0,soundOn=false,audio=null,lastClash=0,lastCharge=0;
const views=[],projectiles=[],hitBoxes=[],keys=new Set();
function instanced(geometry,material,count=24){const m=new THREE.InstancedMesh(geometry,material,count);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;scene.add(m);return m;}
function makeLabel(){const c=document.createElement('canvas');c.width=512;c.height=112;const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true}));sprite.scale.set(12,2.625,1);scene.add(sprite);return {c,texture,sprite,text:''};}
function createViews(){
 for(const s of battle.squads){const cloth=s.side?materials.red:materials.blue;
  const parts=s.type==='horse'
   ?{horseBody:instanced(new THREE.BoxGeometry(.75,.8,1.8),materials.horse),horseHead:instanced(new THREE.BoxGeometry(.38,.42,.62),materials.horseDark),leg:instanced(new THREE.BoxGeometry(.16,.78,.16),materials.boots,96),body:instanced(new THREE.BoxGeometry(.6,.75,.38),cloth),head:instanced(new THREE.SphereGeometry(.22,7,5),materials.skin),helmet:instanced(new THREE.SphereGeometry(.27,7,5,0,Math.PI*2,0,Math.PI/2),materials.steel),arm:instanced(new THREE.BoxGeometry(.16,.6,.18),cloth),weapon:instanced(new THREE.CylinderGeometry(.04,.04,2.9,4),materials.wood)}
   :{body:instanced(new THREE.BoxGeometry(.68,.8,.4),cloth),head:instanced(new THREE.SphereGeometry(.23,7,5),materials.skin),helmet:instanced(new THREE.SphereGeometry(.28,7,5,0,Math.PI*2,0,Math.PI/2),materials.steel),leftLeg:instanced(new THREE.BoxGeometry(.2,.67,.22),materials.boots),rightLeg:instanced(new THREE.BoxGeometry(.2,.67,.22),materials.boots),arm:instanced(new THREE.BoxGeometry(.18,.65,.2),cloth),shield:instanced(new THREE.BoxGeometry(.6,.78,.1),cloth),weapon:instanced(s.type==='spear'?new THREE.CylinderGeometry(.035,.035,3.1,4):s.type==='bow'?new THREE.TorusGeometry(.43,.04,4,10,Math.PI):new THREE.BoxGeometry(.09,1.1,.07),s.type==='spear'?materials.wood:s.type==='bow'?materials.bow:materials.steel)};
  const cavalry=s.type==='horse';
  const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints((cavalry?[[-7,-5],[7,-5],[7,5],[-7,5]]:[[-6,-3.8],[6,-3.8],[6,3.8],[-6,3.8]]).map(([x,z])=>new THREE.Vector3(x,.045,z))),new THREE.LineBasicMaterial({color:'#efcf85',transparent:true,opacity:.9}));scene.add(ring);
  const pole=mesh(new THREE.CylinderGeometry(.06,.06,6,5),materials.wood,s.x,3,s.z),flag=mesh(new THREE.PlaneGeometry(2.4,1.5,5,2),cloth,s.x+1.2,5.2,s.z);flag.material=cloth.clone();flag.material.side=THREE.DoubleSide;flag.castShadow=true;
  const box=new THREE.Mesh(cavalry?new THREE.BoxGeometry(14,7,10):new THREE.BoxGeometry(12,7,9),new THREE.MeshBasicMaterial({visible:false}));box.userData.squad=s.id;scene.add(box);hitBoxes.push(box);
  views.push({parts,ring,pole,flag,box,label:makeLabel(),angle:s.angle,cavalry});
 }
}
createViews();
function setPart(part,index,x,y,z,rx=0,ry=0,rz=0){dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(1,1,1);dummy.updateMatrix();part.setMatrixAt(index,dummy.matrix);}
function pose(t){
 for(const s of battle.squads){const view=views[s.id],active=living(s);view.angle+=Math.atan2(Math.sin(s.angle-view.angle),Math.cos(s.angle-view.angle))*.12;const a=view.angle,sn=Math.sin(a),cs=Math.cos(a);
  const put=(part,i,x,y,z,rx=0,rz=0)=>setPart(part,i,s.x+x*cs+z*sn,y,s.z-x*sn+z*cs,rx,a,rz);
  for(const part of Object.values(view.parts)){part.count=active?s.count:0;}
  if(view.cavalry)view.parts.leg.count=active?s.count*4:0;
  if(view.cavalry){for(let i=0;i<s.count&&active;i++){
   const x=(i%6-2.5)*2.3,z=(Math.floor(i/6)-1.5)*3,phase=t*(s.running?11:8)+i*1.3,bob=s.moving?Math.abs(Math.cos(phase))*.09:Math.sin(t*2+i)*.014;
   put(view.parts.horseBody,i,x,1.05+bob,z);put(view.parts.horseHead,i,x,1.5+bob,z+1.05,s.moving?Math.sin(phase)*.12:0);
   for(let k=0;k<4;k++){const lx=k%2?.27:-.27,lz=k<2?.62:-.62,swing=s.moving?Math.sin(phase+(k%2?Math.PI:0)+(k<2?0:Math.PI/2))*.5:0;setPart(view.parts.leg,i*4+k,s.x+(x+lx)*cs+(z+lz)*sn,.42,s.z-(x+lx)*sn+(z+lz)*cs,swing,a,0);}
   put(view.parts.body,i,x,1.95+bob,z);put(view.parts.head,i,x,2.6+bob,z);put(view.parts.helmet,i,x,2.68+bob,z);
   const swing=s.engaged?Math.sin(t*8+i)*.7:0;
   put(view.parts.arm,i,x+.42,2+bob,z,-swing-.35);put(view.parts.weapon,i,x+.5,2.1+bob,z+.75,s.engaged?1.3:1.12);
  }}else for(let i=0;i<s.count&&active;i++){
   const x=(i%6-2.5)*1.65,z=(Math.floor(i/6)-1.5)*1.8,phase=t*(s.running?12:8)+i*1.7,walk=s.moving?Math.sin(phase)*.5:0,bob=s.moving?Math.abs(Math.cos(phase))*.06:Math.sin(t*2+i)*.014;
   put(view.parts.body,i,x,1.12+bob,z);put(view.parts.head,i,x,1.8+bob,z);put(view.parts.helmet,i,x,1.89+bob,z);
   put(view.parts.leftLeg,i,x-.18,.38,z+walk*.18,walk);put(view.parts.rightLeg,i,x+.18,.38,z-walk*.18,-walk);
   const swing=s.engaged?Math.sin(t*8+i)*.7:walk*.6;
   put(view.parts.arm,i,x+.46,1.15+bob,z+.05,-swing);put(view.parts.shield,i,x-.46,1.1+bob,z+.28,0,s.type==='bow'?Math.PI/2:0);
   put(view.parts.weapon,i,x+.52,s.type==='spear'?1.75:1.5,z+.25,s.type==='spear'?(s.engaged?1.1+Math.sin(t*7+i)*.17:.12):swing);
  }
  for(const part of Object.values(view.parts))part.instanceMatrix.needsUpdate=true;
  view.ring.position.set(s.x,0,s.z);view.ring.rotation.y=a;view.ring.visible=active&&s.side===0&&battle.selected.includes(s.id);
  view.pole.position.set(s.x,3,s.z);view.flag.position.set(s.x+1.2,5.2,s.z);view.flag.rotation.y=.1*Math.sin(t*.8);view.pole.visible=view.flag.visible=active;
  const positions=view.flag.geometry.attributes.position;for(let i=0;i<positions.count;i++){const x=positions.getX(i);positions.setZ(i,Math.sin(t*3+x*2)*.14*(x+1.2));}positions.needsUpdate=true;
  view.box.position.set(s.x,3,s.z);view.box.rotation.y=a;view.box.visible=active;view.label.sprite.position.set(s.x,7,s.z);view.label.sprite.visible=active;
  const text=`${s.name}  ${s.count}  ${s.routing?'ROUTING':s.engaged?'FIGHTING':s.moving?'MOVING':'READY'}`;
  if(text!==view.label.text){view.label.text=text;const ctx=view.label.c.getContext('2d');ctx.clearRect(0,0,512,112);ctx.fillStyle=s.side?'#512d25ed':'#183d4ced';ctx.beginPath();ctx.roundRect(2,5,508,95,12);ctx.fill();ctx.strokeStyle=s.side?'#ce8972':'#a9ccd3';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#f3e7c4';ctx.font='bold 24px Georgia';ctx.textAlign='center';ctx.fillText(s.name,256,43);ctx.font='20px Arial';ctx.fillText(`${s.count} / 24  ·  ${s.routing?'ROUTING':s.engaged?'FIGHTING':s.moving?'MOVING':TYPES[s.type].label.toUpperCase()}`,256,76);view.label.texture.needsUpdate=true;}
 }
}
const marker=new THREE.Mesh(new THREE.RingGeometry(1.1,1.25,32),new THREE.MeshBasicMaterial({color:'#f1d38f',transparent:true,opacity:.9,side:THREE.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.visible=false;scene.add(marker);let markerLife=0;
function message(text){$('message').textContent=text;}
function audioStart(){if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();}
function tone(freq,duration=.15,volume=.045,kind='triangle'){if(!soundOn||!audio)return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type=kind;osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(freq*.65,audio.currentTime+duration);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}
function eventEffects(event){
 if(event.kind==='arrow'){
  const a=battle.squads[event.from],b=battle.squads[event.to];for(let i=0;i<5;i++){const start=new THREE.Vector3(a.x+(i-2)*1.5,1.9,a.z),end=new THREE.Vector3(b.x+(i-2)*1.2,1,b.z);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([start,start.clone().add(new THREE.Vector3(0,0,1))]),new THREE.LineBasicMaterial({color:'#332b1d'}));scene.add(line);projectiles.push({line,start,end,life:0});}tone(820,.12,.018,'sine');
 }else if(event.kind==='clash'&&elapsed-lastClash>.15){lastClash=elapsed;tone(180+random()*160,.08,.025,'square');}
 else if(event.kind==='charge'&&elapsed-lastCharge>1.2){lastCharge=elapsed;const s=battle.squads[event.from];message(s.side===0?`${s.name} charge!`:`${s.name} are charging your line!`);tone(95,.5,.05,'sawtooth');}
 else if(event.kind==='rout'){const s=battle.squads[event.from];message(`${s.name} is routing! ${s.side===0?'Use Rally if they still have enough troops.':'Press the attack.'}`);tone(140,.45,.035,'sawtooth');}
 else if(event.kind==='end')finish();
}
const cards=[];
for(const s of battle.squads.filter(s=>s.side===0)){
 const card=document.createElement('button');card.className='unit-card';card.dataset.unit=s.id;card.innerHTML=`<strong>${s.name}</strong><span class="unit-line"><span>${TYPES[s.type].label}</span><span class="count">24 / 24</span></span><span class="unit-line"><span class="unit-status">Ready</span><span class="morale-value">Morale 100</span></span><span class="bars"><span class="bar health" title="Troops"><i></i></span><span class="bar morale" title="Morale"><i></i></span><span class="bar stamina" title="Stamina"><i></i></span></span>`;
 card.addEventListener('click',e=>{choose(s.id,e.shiftKey);canvas.focus({preventScroll:true});});$('unit-cards').append(card);cards.push(card);
}
function choose(id,add=false){select(battle,add?(battle.selected.includes(id)?battle.selected.filter(i=>i!==id):[...battle.selected,id]):[id]);tone(420,.07,.025);hud();}
function hud(){
 for(let side=0;side<2;side++)$(side?'enemy-count':'friendly-count').textContent=battle.squads.filter(s=>s.side===side&&fighting(s)).reduce((sum,s)=>sum+s.count,0);
 const sec=Math.floor(battle.time);$('timer').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;$('phase').textContent=battle.status==='deployment'?'DEPLOYMENT':battle.status==='paused'?'PAUSED':battle.status==='ended'?'BATTLE ENDED':'BATTLE IN PROGRESS';
 $('pause').textContent=battle.status==='deployment'?'Begin battle':battle.status==='running'?'Pause battle':'Resume battle';$('pause').disabled=battle.status==='ended';
 for(const card of cards){const s=battle.squads[Number(card.dataset.unit)];card.classList.toggle('selected',battle.selected.includes(s.id));card.setAttribute('aria-pressed',String(battle.selected.includes(s.id)));card.classList.toggle('disabled',!fighting(s));card.querySelector('.count').textContent=`${s.count} / 24`;card.querySelector('.unit-status').textContent=!living(s)?'Lost':s.routing?'Routing':s.engaged?'Fighting':s.order.kind==='attack'?'Attacking':s.moving?'Moving':'Holding';card.querySelector('.morale-value').textContent=`Morale ${Math.round(s.morale)}`;for(const [name,value] of [['health',s.hp/s.maxHp*100],['morale',s.morale],['stamina',s.stamina]])card.querySelector(`.${name} i`).style.width=`${value}%`;}
 const selected=battle.squads.filter(s=>battle.selected.includes(s.id)&&fighting(s)),running=selected.length>0&&selected.every(s=>s.running);$('run').textContent=`Run: ${running?'on':'off'}`;$('run').setAttribute('aria-pressed',String(running));$('run').disabled=$('hold').disabled=!selected.length||battle.status==='ended';
 const cooldown=Math.max(0,Math.ceil(30-(battle.time-battle.rallyAt)));$('rally').textContent=cooldown?`Rally (${cooldown}s)`:'Rally troops';$('rally').disabled=battle.status!=='running'||cooldown>0;
}
function finish(){const win=battle.winner===0;$('result').hidden=false;$('result-title').textContent=battle.winner===null?'Draw':win?'Victory':'Defeat';$('result-kicker').textContent=win?'THE FIELD IS YOURS':'THE BANNERS FALL';$('result-description').textContent=win?'The red banners have broken. Your army holds the crossing.':'Your army has broken. Keep infantry together and protect your archers on the next attempt.';tone(win?520:150,.8,.06);hud();}
function reset(){battle=createBattle($('difficulty').value);accumulator=0;keys.clear();$('result').hidden=true;marker.visible=false;for(const p of projectiles){scene.remove(p.line);p.line.geometry.dispose();p.line.material.dispose();}projectiles.length=0;message('Place your regiments on your half of the field, then begin the battle.');frameBattle();hud();}
function pause(){if(battle.status==='ended')return;const old=battle.status;battle.status=old==='running'?'paused':'running';accumulator=0;message(battle.status==='paused'?'Battle paused. You can still give orders.':old==='deployment'?'The red banners advance. Hold the crossing!':'Battle resumed.');tone(330,.25);hud();}
$('pause').onclick=pause;$('restart').onclick=reset;$('play-again').onclick=reset;$('difficulty').onchange=()=>{reset();message('Challenge changed. A fresh battle is ready.');};
$('speed').onclick=()=>{speed=speed===1?2:speed===2?.5:1;$('speed').textContent=`${speed}× speed`;};
$('sound').onclick=()=>{soundOn=!soundOn;if(soundOn){audioStart();tone(440,.15);}$('sound').textContent=`Sound ${soundOn?'on':'off'}`;$('sound').setAttribute('aria-pressed',String(soundOn));};
$('help-toggle').onclick=()=>{$('help').hidden=!$('help').hidden;$('help-toggle').setAttribute('aria-expanded',String(!$('help').hidden));};
$('select-all').onclick=()=>{select(battle,battle.squads.filter(s=>s.side===0&&fighting(s)).map(s=>s.id));hud();};$('hold').onclick=()=>{command(battle,{kind:'hold'});message('Selected regiments: hold position.');hud();};
$('run').onclick=()=>{const selected=battle.squads.filter(s=>battle.selected.includes(s.id));const enable=!selected.every(s=>s.running);for(const s of selected)s.running=enable;hud();};
$('rally').onclick=()=>{if(rally(battle)){message('The horn sounds. Your regiments regain courage.');tone(260,.7,.06,'sawtooth');hud();}};
canvas.addEventListener('contextmenu',e=>e.preventDefault());let down=null;
canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,button:e.button,type:e.pointerType};canvas.focus({preventScroll:true});});
function screenPoint(x,y){const r=canvas.getBoundingClientRect();pointer.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);}
canvas.addEventListener('pointerup',e=>{
 if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)return;const touch=down.type==='touch';down=null;screenPoint(e.clientX,e.clientY);const hit=ray.intersectObjects(hitBoxes).find(h=>living(battle.squads[h.object.userData.squad]));const id=hit?.object.userData.squad;
 if(e.button===0&&id!==undefined&&battle.squads[id].side===0){choose(id,e.shiftKey);return;}
 if(e.button!==2&&!touch)return;if(!battle.selected.length){message('Select a blue regiment first.');return;}
 if(id!==undefined&&battle.squads[id].side===1){command(battle,{kind:'attack',target:id});message(`Attack ${battle.squads[id].name}.`);tone(310,.12);}
 else{const point=ray.intersectObject(ground)[0]?.point;if(!point)return;
  if(battle.status==='deployment'){const selected=battle.squads.filter(s=>battle.selected.includes(s.id)&&fighting(s));selected.forEach((s,i)=>{s.x=Math.max(-42,Math.min(42,point.x+(i-(selected.length-1)/2)*13));s.z=Math.max(8,Math.min(38,point.z));s.angle=Math.PI;s.order={kind:'hold'};s.chargeDistance=0;});marker.position.set(point.x,.06,point.z);marker.visible=true;markerLife=2;message('Deployment position set. Begin when ready.');tone(390,.1);hud();return;}
  command(battle,{kind:'move',x:point.x,z:point.z});const dest=battle.squads.find(s=>battle.selected.includes(s.id)&&fighting(s))?.order;if(dest?.kind==='move'){marker.position.set(dest.x,.06,dest.z);marker.visible=true;markerLife=2;message('Move order given.');tone(390,.1);}}
 hud();
});
const selectBox=document.createElement('div');selectBox.className='select-box';selectBox.hidden=true;host.append(selectBox);let boxStart=null;
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||!e.shiftKey||e.pointerType!=='mouse')return;const r=canvas.getBoundingClientRect();boxStart={x:e.clientX-r.left,y:e.clientY-r.top};Object.assign(selectBox.style,{left:boxStart.x+'px',top:boxStart.y+'px',width:'0px',height:'0px'});selectBox.hidden=false;});
canvas.addEventListener('pointermove',e=>{if(!boxStart)return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;Object.assign(selectBox.style,{left:Math.min(x,boxStart.x)+'px',top:Math.min(y,boxStart.y)+'px',width:Math.abs(x-boxStart.x)+'px',height:Math.abs(y-boxStart.y)+'px'});});
addEventListener('pointerup',e=>{if(!boxStart)return;const r=canvas.getBoundingClientRect(),x1=Math.min(e.clientX-r.left,boxStart.x),x2=Math.max(e.clientX-r.left,boxStart.x),y1=Math.min(e.clientY-r.top,boxStart.y),y2=Math.max(e.clientY-r.top,boxStart.y);boxStart=null;selectBox.hidden=true;if(x2-x1<6&&y2-y1<6)return;const hits=battle.squads.filter(s=>s.side===0&&fighting(s)).map(s=>{v.set(s.x,1,s.z).project(camera);return{id:s.id,x:(v.x+1)*r.width/2,y:(1-v.y)*r.height/2};}).filter(p=>p.x>=x1&&p.x<=x2&&p.y>=y1&&p.y<=y2).map(p=>p.id);if(hits.length){select(battle,[...new Set([...battle.selected,...hits])]);tone(420,.07,.025);message(`${hits.length} regiment${hits.length>1?'s':''} added to selection.`);hud();}});
addEventListener('keydown',e=>{if(e.key==='Shift')controls.enabled=false;if(['INPUT','SELECT','BUTTON'].includes(document.activeElement?.tagName))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='Space')pause();if(e.code==='Digit1')$('select-all').click();if(e.code==='KeyH')$('hold').click();if(e.code==='KeyR'&&!$('rally').disabled)$('rally').click();});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.key==='Shift')controls.enabled=true;});addEventListener('blur',()=>{keys.clear();controls.enabled=true;boxStart=null;selectBox.hidden=true;if(battle.status==='running'){battle.status='paused';accumulator=0;message('Battle paused while the window is away.');hud();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&battle.status==='running'){battle.status='paused';accumulator=0;hud();}});
let compactView=null;new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;if(compactView!==(w<600)){compactView=w<600;frameBattle();}camera.updateProjectionMatrix();}).observe(host);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(battle.status==='running')battle.status='paused';message('Graphics paused. Reload if the battlefield does not return.');hud();});
function animate(now){
 requestAnimationFrame(animate);const dt=Math.min((now-lastFrame)/1000,.1);lastFrame=now;elapsed+=dt;
 if(battle.status==='running'){
  accumulator+=dt*speed;while(accumulator>=1/30){stepBattle(battle,1/30);for(const event of battle.events)eventEffects(event);accumulator-=1/30;if(battle.status!=='running'){accumulator=0;break;}}
 }
 const pan=dt*30,dx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),dz=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
 if(dx||dz){const oldX=controls.target.x,oldZ=controls.target.z;controls.target.x=THREE.MathUtils.clamp(oldX+dx*pan,-48,48);controls.target.z=THREE.MathUtils.clamp(oldZ+dz*pan,-43,43);camera.position.x+=controls.target.x-oldX;camera.position.z+=controls.target.z-oldZ;}
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];if(battle.status==='running')p.life+=dt*speed;const t=Math.min(1,p.life/.7);v.lerpVectors(p.start,p.end,t);v.y+=Math.sin(t*Math.PI)*10;const end=v.clone().add(p.end.clone().sub(p.start).normalize().multiplyScalar(1.5));p.line.geometry.setFromPoints([v.clone(),end]);if(t>=1){scene.remove(p.line);p.line.geometry.dispose();p.line.material.dispose();projectiles.splice(i,1);}}
 if(marker.visible){markerLife-=dt;marker.material.opacity=Math.min(.9,markerLife);marker.scale.setScalar(1+Math.sin(elapsed*6)*.1);if(markerLife<=0)marker.visible=false;}
 pose(battle.time);hudElapsed+=dt;if(hudElapsed>.12){hud();hudElapsed=0;}controls.update();renderer.render(scene,camera);
}
// Read-only inspection hooks for browser verification; no artificial victory button.
window.battleGame={get state(){return battle;},renderer,camera,controls,screenPosition(id){const s=battle.squads[id],r=canvas.getBoundingClientRect();const point=new THREE.Vector3(s.x,1,s.z).project(camera);return {x:r.left+(point.x+1)*r.width/2,y:r.top+(1-point.y)*r.height/2};},worldPosition(x,z){const r=canvas.getBoundingClientRect(),p=new THREE.Vector3(x,0,z).project(camera);return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};},get audioState(){return audio?.state??'off';}};
hud();requestAnimationFrame(animate);
