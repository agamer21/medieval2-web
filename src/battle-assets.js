import * as THREE from 'three';
import {parseMesh} from './mesh.js';
import {decodeTexture,textureAtlas} from './texture.js';
import {installedGame} from './installed-game.js';
import {catalogueFromModeldb} from './native-files.js';

const FORMATIONS=[
 ['spear_militia','England'],['levy_spearmen','England'],['armored_swordsmen','England'],['archer_militia','England'],['mailed_knights','England'],
 ['spear_militia','France'],['dismounted_feudal_knights','France'],['dismounted_chivalric_knights','France'],['peasant_archers','France'],['mailed_knights','France']
];
function renderableGroups(model){
 const categories=new Map();
 for(const group of model.groups){if(group.optional||group.category==='primaryactive1'&&model.groups.some(g=>g.category==='primaryactive0'))continue;if(!categories.has(group.category))categories.set(group.category,[]);categories.get(group.category).push(group);}
 return [...categories.values()].map(groups=>groups[0]);
}
function geometryFor(model,group){
 const positions=model.attributes[0].slice(),normals=model.attributes[3]?.slice();
 for(let i=2;i<positions.length;i+=3)positions[i]*=-1;if(normals)for(let i=2;i<normals.length;i+=3)normals[i]*=-1;
 const indices=group.indices.slice();for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));if(normals)geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));if(model.attributes[4])geometry.setAttribute('uv',new THREE.BufferAttribute(model.attributes[4],2));geometry.setIndex(new THREE.BufferAttribute(indices,1));if(!normals)geometry.computeVertexNormals();geometry.computeBoundingSphere();
 return {geometry,positions,normals};
}
async function prepare(renderer,reader,entry){
 const [meshBytes,mainBytes,attachmentBytes]=await Promise.all([reader.read(entry.mesh),reader.read(entry.main),reader.read(entry.attachment)]),model=parseMesh(meshBytes),main=decodeTexture(mainBytes),attachment=decodeTexture(attachmentBytes),atlas=new THREE.CanvasTexture(textureAtlas(main,attachment));
 atlas.colorSpace=THREE.SRGBColorSpace;atlas.flipY=false;atlas.wrapS=atlas.wrapT=THREE.RepeatWrapping;atlas.anisotropy=renderer.capabilities.getMaxAnisotropy();
 const material=new THREE.MeshStandardMaterial({map:atlas,color:'#fff',roughness:.88,metalness:.04,side:THREE.DoubleSide,alphaTest:.25});
 const parts=renderableGroups(model).map(group=>({name:group.name,...geometryFor(model,group),material}));
 return {model,parts,height:model.bounds.max[1]-model.bounds.min[1],minimumY:model.bounds.min[1]};
}
export async function loadLocalBattleAssets(renderer, formations=FORMATIONS){
 const reader=await installedGame();
 if (!reader) return null;
 const db=new TextDecoder('windows-1252').decode(await reader.read('data/unit_models/battle_models.modeldb')),entries=catalogueFromModeldb(db),cache=new Map(),bySquad=new Map(),selected=[];
 for(let id=0;id<formations.length;id++){
  const [name,faction]=formations[id],entry=entries.find(item=>item.modeldbName===name&&item.faction===faction);if(!entry)continue;
  const key=`${entry.modeldbName}|${entry.faction}`;if(!cache.has(key))cache.set(key,prepare(renderer,reader,entry));selected.push({id,key});
 }
 await Promise.all([...cache].map(async([key,promise])=>cache.set(key,await promise)));
 for(const row of selected)bySquad.set(row.id,cache.get(row.key));
 return {bySquad,modelCount:cache.size,packCount:reader.packCount};
}
