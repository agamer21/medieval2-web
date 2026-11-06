// Original prototype rules; not a reconstruction of the native battle engine.
export const TYPES={spear:{label:'Spearmen',speed:4.4,range:6,damage:7.8,armour:.22},sword:{label:'Swordsmen',speed:4.8,range:5.5,damage:8.8,armour:.25},bow:{label:'Archers',speed:4,range:33,damage:5.8,armour:.05},horse:{label:'Cavalry',speed:8.2,range:6,damage:9.5,armour:.2}};
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const living=s=>s.hp>0&&!s.escaped;
export const fighting=s=>living(s)&&!s.routing;
const ROSTER=[['Oak Guard','spear'],['Stone Spears','spear'],['Iron Company','sword'],['Greenwood Bows','bow'],['Westgate Lances','horse'],['Red Guard','spear'],['Ash Company','sword'],['Blackthorn Blades','sword'],['Raven Bows','bow'],['Blood Riders','horse']];
export function createBattle(difficulty='normal'){
 const b={time:0,status:'deployment',winner:null,selected:[0],squads:[],events:[],difficulty,rallyAt:-100,tick:0};
 for(let side=0;side<2;side++)for(let i=0;i<5;i++){const [name,type]=ROSTER[side*5+i];b.squads.push({id:side*5+i,side,type,name,x:(i-2)*17,z:side?-27:25,angle:side?0:Math.PI,hp:240,maxHp:240,count:24,morale:100,stamina:100,routing:false,escaped:false,order:{kind:'hold'},running:false,cooldown:.4+i*.18,engaged:false,moving:false,lastHit:-10,lastMelee:-10,chargeDistance:0});}
 return b;
}
export function select(b,ids){b.selected=[...new Set(ids)].filter(id=>b.squads.some(s=>s.id===id&&s.side===0&&fighting(s)));}
export function command(b,order){
 if(b.status==='ended')return;
 const selected=b.squads.filter(s=>b.selected.includes(s.id)&&fighting(s));
 selected.forEach((s,i)=>{
  if(order.kind==='attack'){if(b.squads.some(t=>t.id===order.target&&t.side!==s.side&&living(t)))s.order={...order};}
  else if(order.kind==='move'&&Number.isFinite(order.x)&&Number.isFinite(order.z))s.order={kind:'move',x:Math.max(-44,Math.min(44,order.x+(i-(selected.length-1)/2)*13)),z:Math.max(-39,Math.min(39,order.z))};
  else if(order.kind==='hold')s.order={kind:'hold'};
 });
}
export function rally(b){
 if(b.status!=='running'||b.time-b.rallyAt<30)return false;
 b.rallyAt=b.time;for(const s of b.squads)if(s.side===0&&living(s)&&s.count>=5){s.morale=Math.min(100,s.morale+32);s.routing=false;s.order={kind:'hold'};}b.events.push({kind:'rally'});return true;
}
function advance(s,t,dt,speed){const d=distance(s,t);if(d<.12)return false;const step=Math.min(d,speed*dt);s.x+=(t.x-s.x)/d*step;s.z+=(t.z-s.z)/d*step;s.angle=Math.atan2(t.x-s.x,t.z-s.z);return true;}
export function stepBattle(b,dt){
 if(b.status!=='running'||!Number.isFinite(dt)||dt<=0)return;
 dt=Math.min(dt,.1);b.time+=dt;b.tick++;b.events=[];const hits=[];
 for(const s of b.squads){
  s.engaged=false;s.moving=false;if(!living(s))continue;const startX=s.x,startZ=s.z;
  if(s.routing){s.moving=advance(s,{x:s.x,z:s.side?-53:53},dt,6);if(Math.abs(s.z)>49)s.escaped=true;continue;}
  const enemies=b.squads.filter(e=>e.side!==s.side&&living(e));const nearest=enemies.reduce((a,e)=>!a||distance(s,e)<distance(s,a)?e:a,null);if(!nearest)continue;
  const ordered=b.squads.find(e=>e.id===s.order.target&&e.side!==s.side&&living(e));let target=ordered??nearest;const type=TYPES[s.type],d=distance(s,target);
  if(s.side===1){if(s.type==='bow'&&distance(s,nearest)<13){s.moving=advance(s,{x:s.x,z:s.z-10},dt,3.2);s.z=Math.max(-39,s.z);}else if(d>type.range*.85)s.moving=advance(s,target,dt,type.speed*(b.difficulty==='easy'?.8:1));}
  else if(s.order.kind==='move'){s.moving=advance(s,s.order,dt,type.speed*(s.running&&s.stamina>8?1.55:1));if(distance(s,s.order)<.2)s.order={kind:'hold'};}
  else if(s.order.kind==='attack'&&ordered&&d>type.range*.88)s.moving=advance(s,target,dt,type.speed*(s.running&&s.stamina>8?1.55:1));
  s.stamina=Math.max(0,Math.min(100,s.stamina+dt*(s.moving&&s.running?-7:3)));
  if(s.type==='horse'&&s.moving)s.chargeDistance+=distance(s,{x:startX,z:startZ});
  if(distance(s,nearest)<6)target=nearest;
   const reach=distance(s,target),canFire=s.type==='bow'&&reach>8&&reach<=type.range,canMelee=reach<=(s.type==='bow'?5.5:type.range);s.cooldown-=dt;
   if(canFire||canMelee){s.engaged=true;s.stamina=Math.max(0,s.stamina-dt*4);if(!s.moving)s.angle=Math.atan2(target.x-s.x,target.z-s.z);
    if(s.cooldown<=0){const interval=canFire?2.5:1.15;s.cooldown=interval;const rear=(Math.sin(target.angle)*(s.x-target.x)+Math.cos(target.angle)*(s.z-target.z))/Math.max(.1,reach)<-.35;
     const charge=canMelee&&s.type==='horse'&&s.chargeDistance>=5&&b.time-s.lastMelee>2.5;
     let amount=type.damage*interval*Math.sqrt(s.count/24)*(.65+.35*s.stamina/100)*(1-TYPES[target.type].armour)*(rear?1.35:1);if(charge)amount*=2.3;if(s.type==='spear'&&target.type==='horse')amount*=1.5;if(s.type==='bow'&&!canFire)amount*=.33;if(s.side===1)amount*=b.difficulty==='easy'?.7:b.difficulty==='hard'?1.25:1;
     hits.push({target,amount,rear,shock:charge?6:0});b.events.push({kind:canFire?'arrow':charge?'charge':'clash',from:s.id,to:target.id});
    }
    if(canMelee){s.lastMelee=b.time;if(s.type==='horse')s.chargeDistance=0;}
   }
 }
 for(const {target,amount,rear,shock} of hits){target.hp=Math.max(0,target.hp-amount);target.count=Math.ceil(target.hp/10);target.morale=Math.max(0,target.morale-amount*.3-(rear?3:0)-(shock||0));target.lastHit=b.time;}
 for(const s of b.squads){if(!fighting(s))continue;const nearbyRout=b.squads.some(a=>a.side===s.side&&a.id!==s.id&&a.routing&&distance(a,s)<18);s.morale=Math.max(0,Math.min(100,s.morale+dt*(nearbyRout?-2:b.time-s.lastHit>5?1.4:0)));if(s.morale<22||s.hp<s.maxHp*.15){s.routing=true;s.order={kind:'hold'};b.events.push({kind:'rout',from:s.id});}}
 const sides=[0,1].map(side=>b.squads.some(s=>s.side===side&&fighting(s)));if(!sides[0]||!sides[1]){b.status='ended';b.winner=sides[0]?0:sides[1]?1:null;b.events.push({kind:'end'});}
}
