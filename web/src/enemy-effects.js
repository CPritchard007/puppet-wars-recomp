import * as THREE from 'three';
import {ENEMY_TYPES} from './enemy-ai.js';
export function labelEnemy(actor,type){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');
 ctx.fillStyle='rgba(8,16,22,.8)';ctx.fillRect(0,0,256,64);ctx.fillStyle='#fff';ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.fillText(ENEMY_TYPES[type].name,128,40);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const label=new THREE.Sprite(new THREE.SpriteMaterial({map,depthWrite:false}));label.position.y=(actor.height||3.3)+.5;label.scale.set(2.6,.65,1);actor.add(label);
 const dispose=actor.dispose.bind(actor);actor.dispose=()=>{map.dispose();label.material.dispose();dispose();};
}
export class EnemyEffects{
 constructor(scene,projectiles={}){this.scene=scene;this.projectiles=projectiles;this.meshes=new Map();this.geometry=new THREE.SphereGeometry(1,10,8);}
 remove(id,m){this.scene.remove(m);if(m.material){if(m.userData.originalProjectile)m.material.map.dispose();m.material.dispose();}this.meshes.delete(id);}
 update(sim,actors=new Map()){
  const held=sim.enemies.filter(e=>e.state==='throw'&&actors.has(e.id)&&this.projectiles[ENEMY_TYPES[e.type].projectile]).map(e=>({id:'held-'+e.id,kind:ENEMY_TYPES[e.type].projectile,held:e.id}));
  const items=[...sim.projectiles,...sim.effects,...(sim.cakes||[]),...held],present=new Set(items.map(p=>p.id));
  for(const [id,m]of this.meshes)if(!present.has(id))this.remove(id,m);
  for(const p of items){
   let m=this.meshes.get(p.id);if(!m){
    if(this.projectiles[p.kind]){const map=this.projectiles[p.kind].map.clone();map.needsUpdate=true;m=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));m.userData.originalProjectile=p.kind;}
    else {if(!['blast','impact'].includes(p.kind))throw new Error(`Missing original projectile asset: ${p.kind}`);const color={grenade:0x68754b,fireball:0xff792e,blast:0xffbb35,impact:0xffbb35}[p.kind]||0xffffff;m=new THREE.Mesh(this.geometry,new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false}));}
    this.meshes.set(p.id,m);this.scene.add(m);
   }
   if(m.userData.originalProjectile){const data=this.projectiles[p.kind].data;const frame=data.frames[Math.floor((p.age??sim.time)*data.fps)%data.frames.length];const [u,v,w,h]=frame.uv,[left,top,right,bottom]=frame.bounds;m.material.map.repeat.set(w,h);m.material.map.offset.set(u,v);const scale=['tomato','snowball'].includes(p.kind)?.45:p.kind==='grenade'?.65:1.15;m.scale.set((right-left)*scale,(top-bottom)*scale,1);m.center.set(-left/(right-left),-bottom/(top-bottom));}
   if(p.held){const actor=actors.get(p.held),index=actor.rig.nodes.findIndex(n=>/R Hand$/.test(n.name));const hand=actor.nodes[index];
    if(hand){hand.getWorldPosition(m.position);m.quaternion.identity();m.visible=true;}else m.visible=false;continue;
   }
   m.position.set(p.x,sim.floorY+p.y,p.z);
   const effect=p.kind==='blast'||p.kind==='impact';
   if(m.userData.originalProjectile){m.quaternion.identity();}
   else {m.scale.setScalar(effect?p.radius*(.3+p.age*1.5):.28);m.material.opacity=effect?Math.max(0,.65*(1-p.age/.45)):1;}
  }
 }
 dispose(){for(const [id,m]of this.meshes)this.remove(id,m);this.geometry.dispose();}
}
