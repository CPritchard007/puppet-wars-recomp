import * as THREE from 'three';
import {townTrashSites} from './trash-enemy.js';
import {floorSupportsSpawn} from './spawn-surface.js';
import { fetchJSON } from './diagnostics.js';
import { loadRoster } from './character-roster.js';
import { damageSection } from './destructibles.js';
import { ARENAS,arenaScene } from './arenas.js';
export function geometry(data){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));g.setAttribute('uv1',new THREE.Float32BufferAttribute(data.uv1||data.uv,2));g.setIndex(data.indices);
  if(data.colors?.length)g.setAttribute('color',new THREE.Uint8BufferAttribute(data.colors,4,true));
  for(let i=0;i<data.groups.length;i++)g.addGroup(...data.groups[i],i);g.computeVertexNormals();return g;
}
export async function loadWorld(episode,onProgress,period){
  const arena=ARENAS.find(a=>a.id===episode);if(!arena)throw new Error(`Unknown arena ${episode}`);
  period??=arena.defaultPeriod;const data=await fetchJSON(arenaScene(arena,period));
  const scene=new THREE.Scene();scene.background=new THREE.Color(period==='night'?0x121727:0x96b5bd);scene.fog=new THREE.Fog(scene.background,100,280);
  const root=new THREE.Group();root.scale.z=-1;scene.add(root);
  const loader=new THREE.TextureLoader(),textures=new Map();let loaded=0;
  async function texture(url){if(textures.has(url))return textures.get(url);const promise=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(`Texture timed out: ${url}`)),20000);
    loader.load(url,t=>{clearTimeout(timer);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.wrapS=t.wrapT=THREE.RepeatWrapping;resolve(t);},undefined,()=>{clearTimeout(timer);reject(new Error(`Texture failed to load: ${url}`));});
  });textures.set(url,promise);return promise;}
  const mats={};await Promise.all(Object.entries(data.materials).map(async([id,m])=>{
    const t=m.texture?await texture(m.texture):null;
    if(t){t.repeat.fromArray(m.scale);t.offset.fromArray(m.offset);}
    const lightmap=m.lightmap?await texture(m.lightmap):null;if(lightmap)lightmap.channel=1;
    // Original Transparent/Vertex Colored: texture × vertex RGBA × material tint,
    // SrcAlpha/OneMinusSrcAlpha, ZWrite Off. Render each two-sided sprite once.
    mats[id]=new THREE.MeshBasicMaterial({map:t,lightMap:lightmap,lightMapIntensity:1,
      color:m.vertexBlend?new THREE.Color().setRGB(...m.tint.slice(0,3)):0xffffff,
      opacity:m.vertexBlend?m.tint[3]:1,vertexColors:!!m.vertexBlend,
      transparent:!!m.vertexBlend,depthWrite:!m.vertexBlend,forceSinglePass:true,
      side:THREE.DoubleSide,alphaTest:m.vertexBlend?0:.4});
    if(m.daylightGain)mats[id].color.multiplyScalar(m.daylightGain);
    onProgress?.(`Loading original materials ${++loaded}/${Object.keys(data.materials).length}`);
  }));
  const geos=Object.fromEntries(Object.entries(data.meshes).map(([id,d])=>[id,geometry(d)]));
  const nodes=new Map(),staticMeshes=[],destructibles=[];
  for(const n of data.nodes){const node=new THREE.Group();node.name=n.name;node.position.fromArray(n.position);node.quaternion.fromArray(n.rotation);node.scale.fromArray(n.scale);nodes.set(n.id,node);}
  for(const n of data.nodes){const node=nodes.get(n.id);(nodes.get(n.parent)||root).add(node);
    if(n.mesh&&geos[n.mesh]){const materials=n.materials.map(id=>mats[id]||new THREE.MeshBasicMaterial({color:0x667788,side:THREE.DoubleSide}));const m=new THREE.Mesh(geos[n.mesh],materials.length>1?materials:materials[0]);node.add(m);if(n.destructible){m.geometry=m.geometry.clone();m.geometry.computeBoundingBox();const original=m.geometry.clone();m.userData.destructible={...n.destructible,health:[...n.destructible.health],initial:[...n.destructible.health],original,nodeId:n.id};destructibles.push(m);}if(!/^ELight(?:02)?$/.test(n.name))staticMeshes.push(m);}}
  scene.updateMatrixWorld(true);
  const cameraNode=data.nodes.find(n=>n.name==='Main Camera');
  if(!cameraNode)throw new Error(`No Main Camera found in episode ${episode}`);
  const spawn3=nodes.get(cameraNode.id).getWorldPosition(new THREE.Vector3());
  let floorBox=new THREE.Box3();
  for(const m of staticMeshes)if(/floor/i.test(m.parent.name))floorBox.union(new THREE.Box3().setFromObject(m));
  if(floorBox.isEmpty())throw new Error(`Arena floor is missing in episode ${episode}`);
  const bounds={minX:floorBox.min.x+2,maxX:floorBox.max.x-2,minZ:floorBox.min.z+2,maxZ:floorBox.max.z-2};
  // Limit the first survival slice to the floor around the recovered player spawn.

  const obstacles=[];
  for(const n of data.nodes){if(!n.collider)continue;
    const c=n.collider,center=new THREE.Vector3().fromArray(c.center),half=new THREE.Vector3().fromArray(c.size).multiplyScalar(.5);
    const box=new THREE.Box3(center.clone().sub(half),center.clone().add(half)).applyMatrix4(nodes.get(n.id).matrixWorld);
    if(box.max.y<spawn3.y-1.4||box.min.y>spawn3.y+.5)continue;
    if(box.max.x-box.min.x>bounds.maxX-bounds.minX-2&&box.max.z-box.min.z>bounds.maxZ-bounds.minZ-2)continue;
    if(box.containsPoint(spawn3))continue;
    obstacles.push({nodeId:n.id,minY:box.min.y,maxY:box.max.y,minX:box.min.x-.05,maxX:box.max.x+.05,minZ:box.min.z-.05,maxZ:box.max.z+.05});
  }
  const originalObstacles=obstacles.map(o=>({...o}));
  const pickupData=await fetchJSON('assets/pickups/pickups.json');const pickups=Object.fromEntries(await Promise.all(Object.entries(pickupData).map(async([kind,data])=>[kind,{...data,map:await texture(data.texture)}])));
  const flameMap=await texture('assets/vr/weapons/flame.png');
  const roster=await loadRoster(geometry,texture,onProgress);
  const enemyGroup=new THREE.Group();scene.add(enemyGroup);
  const floorY=floorBox.max.y;spawn3.y=floorY+2.4;
  const positionOf=id=>{const p=nodes.get(id)?.getWorldPosition(new THREE.Vector3());return p?{x:p.x,y:p.y,z:p.z}:null;};
  const teleports=data.teleports.map(t=>({...positionOf(t.destination),rotation:-t.rotation*Math.PI/180})).filter(t=>Number.isFinite(t.x));
  const spawnPoints=data.spawnPoints.map(positionOf).filter(Boolean);
  const trashSpawnPoints=(data.trashSpawnPoints||[]).map(id=>({...positionOf(id),id:`trash-${id}`})).filter(p=>Number.isFinite(p.x));
  const canOccupySpawn=arena.key==='corridor'?floorSupportsSpawn(staticMeshes.filter(m=>/floor/i.test(m.parent.name)),floorY):()=>true;
  const trashParent=nodes.get(data.nodes.find(n=>data.trashSpawnPoints?.includes(n.id))?.parent);
  const trashSitesForPlayer=arena.key==='town'&&trashParent?player=>{
    const local=trashParent.worldToLocal(new THREE.Vector3(player.x,floorY,player.z));
    return townTrashSites(local).map((point,i)=>{const p=trashParent.localToWorld(new THREE.Vector3(...point));return {x:p.x,y:p.y,z:p.z,id:`town-bin-${point[0]}-${point[2]}`};});
  }:null;
  const spawnRay=new THREE.Raycaster(),spawnOrigin=new THREE.Vector3(),spawnDirection=new THREE.Vector3();
  return {deathDurations:Object.fromEntries(Object.entries(roster.templates).map(([key,t])=>[key,t.clips.death.duration])),trashSitesForPlayer,canOccupySpawn,pickups,timeOfDay:period,variantNote:data.variantNote||null,flameMap,arena,teleports,spawnPoints,trashSpawnPoints,originalEnemyNames:data.enemyTypes,scene,root,spawn:{x:spawn3.x,z:spawn3.z},eyeHeight:spawn3.y,floorY,bounds,obstacles,coverPoints:data.nodes.filter(n=>n.active&&/^CoverPosition/.test(n.name)).map(n=>{const p=nodes.get(n.id).getWorldPosition(new THREE.Vector3());return {x:p.x,z:p.z};}),staticMeshes,enemyGroup,roster,
    resetScenery(){obstacles.splice(0,obstacles.length,...originalObstacles.map(o=>({...o})));for(const m of destructibles){const d=m.userData.destructible;d.health=[...d.initial];m.geometry.copy(d.original);}},
    damageScenery(hit,damage){
      const m=hit.object,d=m.userData.destructible;if(!d)return false;
      const point=m.worldToLocal(hit.point.clone()),box=d.original.boundingBox;
      const section=Math.max(0,Math.min(2,Math.floor((point.x-box.min.x)/(box.max.x-box.min.x)*3)));
      const state=damageSection(d.health,section,damage),rect=d.uv[state],base=d.uv[0];if(!rect)return false;
      const uv=m.geometry.attributes.uv,oldUV=d.original.attributes.uv,pos=m.geometry.attributes.position,oldPos=d.original.attributes.position,cx=(box.min.x+box.max.x)/2;
      for(let i=0;i<uv.count;i++){uv.setXY(i,rect[0]+(oldUV.getX(i)-base[0])/base[2]*rect[2],rect[1]+(oldUV.getY(i)-base[1])/base[3]*rect[3]);pos.setXYZ(i,cx+(oldPos.getX(i)-cx)*rect[2]/base[2],box.min.y+(oldPos.getY(i)-box.min.y)*rect[3]/base[3],oldPos.getZ(i));}
      uv.needsUpdate=pos.needsUpdate=true;m.geometry.computeBoundingBox();m.geometry.computeBoundingSphere();
      if(d.health.every(h=>h===0))for(let i=obstacles.length-1;i>=0;i--)if(obstacles[i].nodeId===d.nodeId)obstacles.splice(i,1);
      return true;
    },
    canSpawn(x,z,player){
      spawnOrigin.set(player.x,spawn3.y,player.z);spawnDirection.set(x,floorY+2,z).sub(spawnOrigin);
      spawnRay.set(spawnOrigin,spawnDirection.clone().normalize());spawnRay.far=spawnDirection.length();
      return spawnRay.intersectObjects(staticMeshes,false).length===0;
    },
    makePuppet(type){const actor=roster.create(type);enemyGroup.add(actor);return actor;},
    dispose(){const materials=new Set(),geometries=new Set(),maps=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){materials.add(m);if(m.map)maps.add(m.map);if(m.lightMap)maps.add(m.lightMap);}});roster.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());maps.forEach(t=>t?.dispose());}}
}
export async function loadImage(url){return new Promise((resolve,reject)=>{const i=new Image();const timer=setTimeout(()=>reject(new Error(`Image timed out: ${url}`)),20000);i.onload=()=>{clearTimeout(timer);resolve(i);};i.onerror=()=>{clearTimeout(timer);reject(new Error(`Image failed: ${url}`));};i.src=url;});}
