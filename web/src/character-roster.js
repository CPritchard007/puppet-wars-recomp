import * as THREE from 'three';


export function makeClips(rig){
 return Object.fromEntries(Object.entries(rig.clips).map(([state,clip])=>[state,new THREE.AnimationClip(state,clip.duration,clip.tracks.map(t=>{
  if(!rig.nodes[t.node])throw new Error(`${rig.sourceRoot}: unbound ${state} animation`);
  const Track=t.property==='quaternion'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;
  return new Track(`bone_${t.node}.${t.property}`,t.times,t.values);
 }))]));
}
export class RecoveredCharacter extends THREE.Group{
 constructor(template){
  super();this.template=template;this.rig=template.rig;this.name=this.rig.sourceRoot;this.modelType=template.type;this.state=null;this.hitVersion=0;this.lastEvent=0;this.disposed=false;
  this.display=new THREE.Group();this.add(this.display);
  this.nodes=this.rig.nodes.map((n,i)=>{const node=new THREE.Bone();node.name=`bone_${i}`;node.position.fromArray(n.position);node.quaternion.fromArray(n.rotation);node.scale.fromArray(n.scale);return node;});
  this.rig.nodes.forEach((n,i)=>(n.parent<0?this.display:this.nodes[n.parent]).add(this.nodes[i]));
  this.meshes=[];this.skeletons=[];
  for(let i=0;i<this.rig.parts.length;i++){
   const part=this.rig.parts[i],resource=template.parts[i];const materials=resource.materials.map(m=>m.clone());
   const m=part.bones?new THREE.SkinnedMesh(resource.geometry,materials.length===1?materials[0]:materials):new THREE.Mesh(resource.geometry,materials.length===1?materials[0]:materials);
   m.name=part.name;m.frustumCulled=false;m.userData.role=part.role;this.nodes[part.node].add(m);this.meshes.push(m);
   this.updateMatrixWorld(true);
   if(part.bones){const bind=m.matrixWorld.clone(),inverse=bind.clone().invert();const skeleton=new THREE.Skeleton(part.bones.map(b=>this.nodes[b]),part.bindPoses.map(v=>new THREE.Matrix4().set(...v).multiply(inverse)));m.bind(skeleton,bind);m.normalizeSkinWeights();this.skeletons.push(skeleton);}
  }
  this.mesh=this.meshes[this.rig.primaryPart];this.skeleton=this.mesh.skeleton||this.skeletons[0];
  this.mixer=new THREE.AnimationMixer(this.display);this.actions={};
  for(const [state,clip]of Object.entries(template.clips)){const a=this.mixer.clipAction(clip);a.setLoop(this.rig.clips[state].loop?THREE.LoopRepeat:THREE.LoopOnce,this.rig.clips[state].loop?Infinity:1);a.clampWhenFinished=!this.rig.clips[state].loop;this.actions[state]=a;}
  this.play('idle',0);this.update(0);
  const bounds=new THREE.Box3();
  for(const m of this.meshes)if(m.userData.role!=='umbrella'){if(m.isSkinnedMesh){m.computeBoundingBox();bounds.union(m.boundingBox.clone().applyMatrix4(m.matrixWorld));}else bounds.union(new THREE.Box3().setFromObject(m));}
  const height=bounds.max.y-bounds.min.y;if(!Number.isFinite(height)||height<.001)throw new Error(`${this.name}: invalid skinned model bounds`);
  const scale=this.rig.height/height,[sx,,sz]=this.rig.proportions;this.display.scale.set(scale*sx,scale,scale*sz);
  this.display.position.set(-(bounds.min.x+bounds.max.x)*scale*sx/2,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)*scale*sz/2);
  this.height=this.rig.height;this.update(0);
 }
 play(state,fade=.12,restart=false){
  if(this.disposed||this.state==='death'||this.state===state&&!restart)return;
  if(!this.actions[state])throw new Error(`${this.name}: missing ${state} clip`);
  const previous=this.actions[this.state],next=this.actions[state];this.state=state;next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
  if(previous&&previous!==next&&fade>0)next.crossFadeFrom(previous,fade,false);else if(previous!==next)previous?.stop();this.mixer.update(0);
 }
 update(dt,state=this.state,hitVersion=this.hitVersion,event=this.lastEvent){
  if(this.disposed)return;
  if(state==='death')this.play('death',.08);
  else if(hitVersion!==this.hitVersion){this.hitVersion=hitVersion;this.play('hit',.06,true);}
  else if(!(state==='cover'&&this.state==='throw'&&this.actions.throw.time<this.template.clips.throw.duration-.01)&&(this.state!=='hit'||this.actions.hit.time>=this.template.clips.hit.duration-.01))this.play(state,.12,event!==this.lastEvent);
  this.lastEvent=event;
  for(const m of this.meshes)if(m.userData.role==='umbrella')m.visible=state==='defend';
  this.mixer.update(Math.max(0,dt));this.updateMatrixWorld(true);for(const skeleton of this.skeletons)skeleton.update();
  for(const m of this.meshes)if(m.isSkinnedMesh){m.boundingBox=null;m.boundingSphere=null;}
 }
 setEnemyId(id){this.userData.enemyId=id;for(const m of this.meshes)m.userData.enemyId=id;}
 setTint(color){for(const m of this.meshes)for(const material of Array.isArray(m.material)?m.material:[m.material])material.color.setHex(color);}
 snapshot(){return {model:this.modelType,sourceRoot:this.rig.sourceRoot,state:this.state,source:this.rig.clips[this.state].source,time:this.actions[this.state].time,bones:this.skeletons.reduce((sum,s)=>sum+s.bones.length,0),pose:this.nodes.map(n=>n.quaternion.toArray())};}
 dispose(){if(this.disposed)return;this.disposed=true;this.mixer.stopAllAction();this.mixer.uncacheRoot(this.display);for(const s of this.skeletons)s.dispose();for(const m of this.meshes)for(const material of Array.isArray(m.material)?m.material:[m.material])material.dispose();this.removeFromParent();}
}
export async function loadRoster(geometry,texture,onProgress){
 const {fetchJSON}=await import('./diagnostics.js');
 const manifest=await fetchJSON('assets/enemies/manifest.json');const templates={},projectiles={};let count=0;
 async function resources(parts){return Promise.all(parts.map(async part=>{
  const g=geometry(part.geometry);if(part.bones){g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(part.geometry.skinIndices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(part.geometry.skinWeights,4));}
  const materials=await Promise.all(part.materials.map(async m=>new THREE.MeshBasicMaterial({map:await texture(m.texture),side:THREE.DoubleSide})));
  return {geometry:g,materials};
 }));}
 // A few large rigs at a time keep loading responsive on mobile browsers.
 const entries=Object.entries(manifest.characters);
 for(let offset=0;offset<entries.length;offset+=3)await Promise.all(entries.slice(offset,offset+3).map(async([type,entry])=>{
  const rig=await fetchJSON(entry.url);if(rig.version!==2)throw new Error(`Unsupported character rig: ${type}`);
  templates[type]={type,rig,parts:await resources(rig.parts),clips:makeClips(rig)};onProgress?.(`Loading original characters ${++count}/${entries.length}`);
 }));
 manifest.projectiles.cake='assets/vr/weapons/cake-projectile.json';
 for(const [type,url]of Object.entries(manifest.projectiles)){
  const data=await fetchJSON(url),map=await texture(data.material.texture);projectiles[type]={data,map,parts:[]};
 }
 return {templates,projectiles,create(type){if(!templates[type])throw new Error(`No original model registered for enemy ${type}`);return new RecoveredCharacter(templates[type]);},
  dispose(){for(const p of Object.values(projectiles))p.map.dispose();for(const resource of [...Object.values(templates),...Object.values(projectiles)])for(const p of resource.parts){p.geometry.dispose();for(const m of p.materials){m.map?.dispose();m.dispose();}}}};
}
export function characterAnimation(enemy,actor){
 const state={throw:'throw',coverWait:'cover',windup:'attack',recoverAttack:'attack',fuse:'fuse',jump:'jump',roll:'roll',magic:'magic',teleport:'teleport',transform:'transform',defend:'defend',firebreath:'firebreath',charge:'charge',down:'knockdown',rise:'recover'}[enemy.state]||enemy.animation||'idle';
 if(actor.actions[state])return state;
 return actor.actions[enemy.animation]?enemy.animation:'idle';
}

// Keep the world-facing direction throughout falling, lying down and rising.
export function characterFacing(enemy,player,current){
 if(enemy.animation==='death'||enemy.state==='down'||enemy.state==='rise'||enemy.animation==='knockdown'||enemy.animation==='recover')return current;
 return enemy.animation==='run'&&Number.isFinite(enemy.heading)?enemy.heading:Math.atan2(player.x-enemy.x,player.z-enemy.z);
}
