import * as THREE from 'three';
import {OrbitControls} from '../vendor/three/OrbitControls.js';
import {parseMesh} from './mesh.js';
import {decodeTexture,textureAtlas} from './texture.js';
import {parseAnimation,NativeRig,makeSkinMap,skinVertices} from './animation.js';
import {openGameFiles,openRemoteGameFiles} from './pack.js';
import {catalogueFromModeldb,nativeLibraryFromGame} from './native-files.js';
import {parseUnitDefinitions,findSpearMilitia} from './units.js';
const $=id=>document.getElementById(id),canvas=$('scene'),host=canvas.parentElement;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
const scene=new THREE.Scene();scene.background=new THREE.Color('#64766e');scene.fog=new THREE.Fog('#64766e',26,105);
const camera=new THREE.PerspectiveCamera(38,1,.03,300);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=.45;controls.maxDistance=140;controls.mouseButtons.RIGHT=null;
scene.add(new THREE.HemisphereLight('#f6efdb','#435439',2.4));
const sunlight=new THREE.DirectionalLight('#fff2d2',3.2);sunlight.position.set(4,8,-5);scene.add(sunlight);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshStandardMaterial({color:'#687b54',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;scene.add(floor);
const grid=new THREE.GridHelper(100,100,'#8b9a69','#71825b');grid.material.transparent=true;grid.material.opacity=.32;scene.add(grid);
const origin=new THREE.Group();scene.add(origin);
const marker=new THREE.Mesh(new THREE.RingGeometry(.35,.39,48),new THREE.MeshBasicMaterial({color:'#e3d796',side:THREE.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.position.y=.015;marker.visible=false;scene.add(marker);
let model=null,atlas=null,mainImage=null,attachmentImage=null,meshes=[],chosen=[],entries=[],currentName='',loadEpoch=0;
let library=null,rig=null,extraRigs=[],skinMap=null,skinPositions=null,skinNormals=null,animationTime=0,playing=true,supportsNative=false;
let selectedFiles=null;
let animationSelectionTouched=false;
let nativeUnitDefinition=null;
const target=new THREE.Vector3(),keys=new Set(),raycaster=new THREE.Raycaster();
const state={ready:false,vertices:0,bones:0,triangles:0,copies:1,renderFrames:0,modelName:'',lastError:null,target:[0,0,0],sourceKind:'original asset',animation:'static bind pose',movement:'prototype formation translation'};
window.assetLab={state,renderer,scene,camera,controls,parseMesh};
function status(message,error=false){$('loading').hidden=false;$('loading').classList.toggle('error',error);$('loading-text').textContent=message;if(error)state.lastError=message;}
function refreshSize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(refreshSize).observe(host);refreshSize();
function clearGeometry(){for(const mesh of meshes){origin.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();mesh.dispose?.();}meshes=[];}
function fit(){
  const rows=Math.ceil(Math.sqrt(state.copies)),size=model?Math.max(2.5,rows*2.2):3;
  const centerY=model?(model.bounds.max[1]-model.bounds.min[1])*.5:1;
  controls.target.set(origin.position.x,centerY,origin.position.z);
  camera.position.set(origin.position.x+size*.85,centerY+size*.55,origin.position.z-size*1.8);controls.update();
}
function rebuild(reframe=false){
  if(!model)return;clearGeometry();const byCategory=new Map();
  for(const group of model.groups){if(group.optional)continue;if(group.category==='primaryactive1'&&model.groups.some(g=>g.category==='primaryactive0'))continue;
    if(!byCategory.has(group.category))byCategory.set(group.category,[]);byCategory.get(group.category).push(group);}
  const variant=Number($('variant').value);chosen=[...byCategory.values()].map(groups=>groups[variant%groups.length]);
  const positions=model.attributes[0].slice(),normals=model.attributes[3]?.slice();
  for(let i=2;i<positions.length;i+=3)positions[i]*=-1;if(normals)for(let i=2;i<normals.length;i+=3)normals[i]*=-1;
  skinPositions=positions;skinNormals=normals;
  const animated=rig&&$('animation').value!=='bind';
  const floorOffset=animated?0:-model.bounds.min[1],columns=Math.ceil(Math.sqrt(state.copies)),rows=Math.ceil(state.copies/columns),dummy=new THREE.Object3D();
  for(const group of chosen){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    if(normals)geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
    if(model.attributes[4])geometry.setAttribute('uv',new THREE.BufferAttribute(model.attributes[4],2));
    const indices=group.indices.slice();for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];geometry.setIndex(new THREE.BufferAttribute(indices,1));
    if(!normals)geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const surface=$('surface').value;
    const material=surface==='normals'?new THREE.MeshNormalMaterial({side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({map:surface==='textured'?atlas:null,color:atlas&&surface==='textured'?'#ffffff':'#d7c69b',roughness:.88,metalness:.04,wireframe:surface==='wireframe',side:THREE.DoubleSide,alphaTest:.25});
    const mesh=new THREE.InstancedMesh(geometry,material,state.copies);mesh.name=group.category+'/'+group.name;
    for(let i=0;i<state.copies;i++){dummy.position.set((i%columns-(columns-1)/2)*2.2,floorOffset,(Math.floor(i/columns)-(rows-1)/2)*2.2);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.frustumCulled=false;origin.add(mesh);meshes.push(mesh);
  }
  state.triangles=chosen.reduce((n,g)=>n+g.indices.length/3,0);$('triangles').textContent=state.triangles.toLocaleString();
  $('mode-label').textContent=animated?'ORIGINAL CLIP DATA · LOCAL SKINNING':(state.copies===1?'BIND-POSE INSPECTION':`${state.copies} ORIGINAL MODELS · PROTOTYPE MOVEMENT`);
  if(reframe)fit();
}
function updateAtlas(){if(atlas){atlas.dispose();atlas=null;}if(mainImage){atlas=new THREE.CanvasTexture(textureAtlas(mainImage,attachmentImage??mainImage));atlas.colorSpace=THREE.SRGBColorSpace;atlas.flipY=false;atlas.wrapS=atlas.wrapT=THREE.RepeatWrapping;atlas.anisotropy=renderer.capabilities.getMaxAnisotropy();}rebuild();}
function installModel(data,name,path='Local file',decoded=null){
  const parsed=decoded??parseMesh(data);model=parsed;state.vertices=model.vertexCount;state.bones=model.bones.length;state.ready=true;state.lastError=null;state.modelName=name;
  setupSkin();currentName=name;$('unit-title').textContent=name;$('unit-subtitle').textContent='Original model and texture data · local renderer';$('vertices').textContent=model.vertexCount.toLocaleString();$('bones').textContent=model.bones.length;$('bytes').textContent=(model.bytes/1024).toFixed(1)+' KiB';$('source-path').textContent=path;
  origin.position.set(0,0,0);target.set(0,0,0);marker.visible=false;rebuild(true);$('loading').hidden=true;
}
async function openLocalModel(file){
  const epoch=++loadEpoch;
  try{
    if(file.size>64*1024*1024)throw new Error('Model exceeds the 64 MiB limit');
    const data=await file.arrayBuffer();if(epoch!==loadEpoch)return;
    const decoded=parseMesh(data);supportsNative=false;mainImage=null;attachmentImage=null;atlas?.dispose();atlas=null;
    installModel(data,file.name,'Local file',decoded);$('asset-note').textContent='Local model. Load matching diffuse textures for the original colors.';
  }catch(error){if(epoch===loadEpoch)status(error.message,true);}
}
function setupSkin(){
  rig=null;extraRigs=[];skinMap=null;animationTime=0;
  const available=Boolean(library&&supportsNative);$('animation').disabled=!available;$('pause-animation').disabled=!available;
  if(!available){$('animation').value='bind';$('animation-note').textContent='Native clips are available only for the matched catalogue model.';return;}
  rig=new NativeRig(library.spec['MTW2_Spear']);
  for(const extra of library.attachments){const instance=new NativeRig(library.spec[extra.rig]);const parent=rig.names.get(instance.bones[0].name.toLowerCase());if(parent!==undefined)extraRigs.push({instance,parent,clip:extra.clip});}
  skinMap=makeSkinMap(model,rig,extraRigs.map(extra=>extra.instance));
  if($('animation').value==='bind'&&!animationSelectionTouched)$('animation').value='idle';
  $('animation-note').textContent='Decoded native clip · 20 fps interpretation. Native-engine timing comparison pending.';
}
async function loadAnimationLibrary(path){
  const manifest=await (await fetch(path)).json();const spec=await (await fetch(manifest.skeletons)).json();const clips=new Map();
  const read=async path=>{const response=await fetch(path);if(!response.ok)throw new Error('Animation record is unavailable');return response.arrayBuffer();};
  for(const entry of manifest.clips)clips.set(entry.id,{...entry,data:parseAnimation(await read(entry.path))});
  const attachments=[];for(const entry of manifest.attachments??[])attachments.push({...entry,clip:parseAnimation(await read(entry.path))});
  return {spec,clips,attachments};
}
async function getBytes(path){if(selectedFiles)return selectedFiles.read(path);const response=await fetch(path);if(!response.ok)throw new Error(`Could not load ${path} (HTTP ${response.status})`);return response.arrayBuffer();}
function updateLibraryOptions(){
  const previous=$('animation').value;
  $('animation').replaceChildren();const bind=document.createElement('option');bind.value='bind';bind.textContent='Bind pose';$('animation').append(bind);
  for(const entry of library?.clips.values()??[]){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;$('animation').append(option);}
  if(previous==='bind'||library?.clips.has(previous))$('animation').value=previous;
}
function updateEntryOptions(selectedId=null){
  const query=$('unit-search').value.trim().toLowerCase(),previous=selectedId??$('unit-select').value,matching=entries.filter(entry=>!query||`${entry.name} ${entry.faction}`.toLowerCase().includes(query)),visible=matching.slice(0,300);
  if(previous&&matching.some(entry=>entry.id===previous)&&!visible.some(entry=>entry.id===previous))visible.unshift(matching.find(entry=>entry.id===previous));
  $('entry-count').textContent=`${entries.length.toLocaleString()} original model/faction entries · ${query?`${matching.length.toLocaleString()} matches`:'type to search'}`;
  $('unit-select').replaceChildren();if(!visible.length){const empty=document.createElement('option');empty.textContent=entries.length?'No matching models':'Choose your game folder first';$('unit-select').append(empty);return;}
  for(const entry of visible){const option=document.createElement('option');option.value=entry.id;option.textContent=`${entry.name} · ${entry.faction}`;$('unit-select').append(option);}
  if(matching.length>visible.length){const more=document.createElement('option');more.disabled=true;more.textContent=`… ${matching.length-visible.length} more — narrow your search`;$('unit-select').append(more);}
  if(previous&&visible.some(entry=>entry.id===previous))$('unit-select').value=previous;
}
function updateLodOptions(entry){
  const paths=entry.lods?.length?entry.lods:[entry.mesh],selector=$('lod');selector.replaceChildren();
  paths.forEach((path,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=`LOD ${index} · ${path.split('/').pop()}`;selector.append(option);});selector.disabled=paths.length<2;
}
function showNativeDefinition(){
  const definition=nativeUnitDefinition;$('native-definition').hidden=!definition;if(!definition)return;
  $('definition-name').textContent=definition.name;$('definition-fields').replaceChildren();
  for(const [key,label] of [['soldier','Soldier field'],['stat_health','Health field'],['stat_pri','Primary attack field'],['stat_pri_armour','Armour / defence field'],['stat_mental','Morale field']]){
    if(!definition.fields.has(key))continue;const row=document.createElement('div'),term=document.createElement('dt'),value=document.createElement('dd');term.textContent=label;value.textContent=definition.fields.get(key);value.style.overflowWrap='anywhere';row.append(term,value);$('definition-fields').append(row);
  }
  state.unitDefinitionLoaded=true;
}
$('game-folder').addEventListener('change',async e=>{
  if(!e.target.files.length)return;const epoch=++loadEpoch;status('Reading original game files locally…');
  try{
    const reader=await openGameFiles(e.target.files,message=>{if(epoch===loadEpoch)status(message);});
    const db=new TextDecoder('windows-1252').decode(await reader.read('data/unit_models/battle_models.modeldb'));
    const newEntries=catalogueFromModeldb(db),newLibrary=await nativeLibraryFromGame(reader);
    const definitions=parseUnitDefinitions(new TextDecoder('windows-1252').decode(await reader.read('data/export_descr_unit.txt')));if(epoch!==loadEpoch)return;
    nativeUnitDefinition=findSpearMilitia(definitions);showNativeDefinition();
    selectedFiles=reader;library=newLibrary;entries=newEntries;state.modelCatalogueCount=entries.length;updateLibraryOptions();const initial=entries.find(e=>e.modeldbName==='spear_militia'&&e.faction==='England')??entries[0];updateEntryOptions(initial?.id);if(initial)updateLodOptions(initial);
    state.sourceKind='browser-selected game files';state.archiveMembers=reader.memberCount;state.archiveMetadataBytes=reader.metadataBytes;
    await loadEntry(initial);$('asset-note').textContent=`Read ${reader.packCount} archives directly. Files remain local; no extraction tool or upload.`;
  }catch(error){if(epoch===loadEpoch)status(error.message,true);}
});
async function loadEntry(entry){
  const epoch=++loadEpoch;state.ready=false;status('Decoding original model and textures…');
  try{
    const meshPath=entry.lods?.[Number($('lod').value)]??entry.mesh,[geometry,main,attachment]=await Promise.all([getBytes(meshPath),getBytes(entry.main),getBytes(entry.attachment)]);
    if(epoch!==loadEpoch)return;const decodedMain=decodeTexture(main),decodedAttachment=decodeTexture(attachment);
    mainImage=decodedMain;attachmentImage=decodedAttachment;supportsNative=entry.modeldbName==='spear_militia'||meshPath.endsWith('/spear_militia_lod0.mesh');updateAtlas();installModel(geometry,`${entry.name} · ${entry.faction}`,meshPath.replace('/assets/',''));
    $('asset-note').textContent='Original model + modeldb-matched faction textures. All local.';
  }catch(error){if(epoch!==loadEpoch)return;status(error.message,true);}
}
$('unit-search').addEventListener('input',()=>updateEntryOptions());
$('unit-select').addEventListener('change',e=>{const entry=entries.find(entry=>entry.id===e.target.value);if(entry){updateLodOptions(entry);loadEntry(entry);}});
$('lod').addEventListener('change',()=>{const entry=entries.find(entry=>entry.id===$('unit-select').value);if(entry)loadEntry(entry);});
$('mesh-file').addEventListener('change',e=>{const file=e.target.files[0];if(file)openLocalModel(file);});
for(const [id,kind] of [['main-texture','main'],['attachment-texture','attachment']])$(id).addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const image=decodeTexture(await file.arrayBuffer());if(kind==='main')mainImage=image;else attachmentImage=image;updateAtlas();}catch(error){status(error.message,true);}});
for(const id of ['variant','surface'])$(id).addEventListener('change',()=>rebuild());
$('animation').addEventListener('change',()=>{animationSelectionTouched=true;animationTime=0;rebuild();});
$('pause-animation').addEventListener('click',()=>{playing=!playing;$('pause-animation').textContent=playing?'Pause animation':'Resume animation';});
$('formation').addEventListener('change',e=>{state.copies=Number(e.target.value);rebuild(true);});$('reframe').addEventListener('click',fit);
$('reset-position').addEventListener('click',()=>{target.set(0,0,0);origin.position.set(0,0,0);state.target=[0,0,0];marker.visible=false;fit();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==2||!model)return;const bounds=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1),camera);
  const hit=raycaster.intersectObject(floor)[0];if(hit){target.copy(hit.point);target.y=0;state.target=target.toArray();marker.position.set(target.x,.015,target.z);marker.visible=true;}
});
addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;keys.add(e.code);if(e.code==='KeyR')fit();});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
host.addEventListener('dragover',e=>e.preventDefault());host.addEventListener('drop',e=>{e.preventDefault();const file=[...e.dataTransfer.files].find(f=>f.name.toLowerCase().endsWith('.mesh'));if(file)openLocalModel(file);});
let last=performance.now(),fpsAt=last,frames=0;
renderer.setAnimationLoop(now=>{
  const dt=Math.min((now-last)/1000,.05);last=now;
  if(model&&rig&&skinMap&&skinPositions){
    const selected=library.clips.get($('animation').value);
    if(selected){if(playing)animationTime+=dt;state.animation=selected.id;state.animationFrame=rig.pose(selected.data,animationTime);
      for(const extra of extraRigs)extra.instance.pose(extra.clip,animationTime,rig.world[extra.parent]);
      skinVertices(model,skinMap,skinPositions,skinNormals);
      for(const mesh of meshes){mesh.geometry.attributes.position.needsUpdate=true;if(mesh.geometry.attributes.normal)mesh.geometry.attributes.normal.needsUpdate=true;}
    }else{state.animation='static bind pose';state.animationFrame=0;}
  }
  const delta=new THREE.Vector3().subVectors(target,origin.position);if(delta.length()>.01)origin.position.addScaledVector(delta,Math.min(1,dt*2/delta.length()));
  if(keys.size){const f=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();const right=new THREE.Vector3().crossVectors(f,camera.up).normalize(),pan=new THREE.Vector3();
    if(keys.has('KeyW'))pan.add(f);if(keys.has('KeyS'))pan.sub(f);if(keys.has('KeyD'))pan.add(right);if(keys.has('KeyA'))pan.sub(right);pan.multiplyScalar(dt*camera.position.distanceTo(controls.target)*.5);camera.position.add(pan);controls.target.add(pan);}
  controls.update();renderer.render(scene,camera);state.renderFrames++;frames++;
  if(now-fpsAt>750){$('performance').textContent=`${Math.round(frames*1000/(now-fpsAt))} FPS`;frames=0;fpsAt=now;}
});
async function initialize(){
  const epoch=loadEpoch;
  try{const response=await fetch('./api/game',{cache:'no-store'});if(response.ok){const game=await response.json();if(game.available){
    status('Using the installed game files locally…');const reader=await openRemoteGameFiles(game,message=>{if(epoch===loadEpoch)status(message);});
    const db=new TextDecoder('windows-1252').decode(await reader.read('data/unit_models/battle_models.modeldb'));
    const newEntries=catalogueFromModeldb(db),newLibrary=await nativeLibraryFromGame(reader);
    const definitions=parseUnitDefinitions(new TextDecoder('windows-1252').decode(await reader.read('data/export_descr_unit.txt')));if(epoch!==loadEpoch)return;
    nativeUnitDefinition=findSpearMilitia(definitions);showNativeDefinition();selectedFiles=reader;library=newLibrary;entries=newEntries;state.modelCatalogueCount=entries.length;updateLibraryOptions();const initial=entries.find(e=>e.modeldbName==='spear_militia'&&e.faction==='England')??entries[0];updateEntryOptions(initial?.id);if(initial)updateLodOptions(initial);
    state.sourceKind='auto-detected local Steam installation';state.archiveMembers=reader.memberCount;state.archiveMetadataBytes=reader.metadataBytes;
    for(const element of [$('game-folder').closest('.file-button'),$('mesh-file').closest('.file-button'),$('main-texture').closest('details')]){element.hidden=true;element.style.display='none';}
    await loadEntry(initial);$('asset-note').textContent=`Read ${reader.packCount} installed packs directly. Original files stay on this PC; nothing is uploaded.`;return;
  }}}catch(error){if(epoch===loadEpoch)$('animation-note').textContent=`Local auto-detection unavailable: ${error.message}`;}
  try{const response=await fetch('./catalog.json');if(!response.ok)throw new Error('No local catalogue');const catalog=await response.json();let initialLibrary=null;
    if(catalog.animations)try{initialLibrary=await loadAnimationLibrary(catalog.animations);}catch(error){if(epoch===loadEpoch)$('animation-note').textContent='Animation data unavailable; bind-pose inspection still works.';}
    if(epoch!==loadEpoch)return;library=initialLibrary;entries=catalog.entries??[];state.modelCatalogueCount=entries.length;updateLibraryOptions();updateEntryOptions();
    if(entries.length)try{const data=await getBytes('/assets/data/export_descr_unit.txt');if(epoch!==loadEpoch)return;nativeUnitDefinition=findSpearMilitia(parseUnitDefinitions(new TextDecoder('windows-1252').decode(data)));showNativeDefinition();}catch{}
    if(entries.length){$('unit-select').value=entries[0].id;updateLodOptions(entries[0]);await loadEntry(entries[0]);}
    else{status('Choose your installed game folder, or open a local .mesh.');fit();}
  }catch(error){if(epoch===loadEpoch){status('Choose your installed game folder, or open a local .mesh.');fit();}}
}
initialize();
