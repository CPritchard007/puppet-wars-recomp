import * as THREE from 'three';
import {GazeDwell} from './vr-controls.js';
import {validPoint} from './enemy-navigation.js';
export class VRExperience{
 constructor(renderer,camera,weaponCanvas,{onEnd,onAction,onError}){
  this.renderer=renderer;this.camera=camera;this.onAction=onAction;this.onError=onError;this.rig=new THREE.Group();this.dwell=new GazeDwell();this.ray=new THREE.Raycaster();this.buttons=[];this.markers=[];this.controllers=[];this.down=false;this.previous={};renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
  this.weaponMap=new THREE.CanvasTexture(weaponCanvas);this.weaponMap.colorSpace=THREE.SRGBColorSpace;this.weapon=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.7),new THREE.MeshBasicMaterial({map:this.weaponMap,transparent:true,depthWrite:false,side:THREE.DoubleSide}));this.weapon.position.set(0,-.2,-.7);this.weapon.renderOrder=10;
  this.hudCanvas=document.createElement('canvas');this.hudCanvas.width=1024;this.hudCanvas.height=256;this.hudMap=new THREE.CanvasTexture(this.hudCanvas);this.hudMap.colorSpace=THREE.SRGBColorSpace;this.hud=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.375),new THREE.MeshBasicMaterial({map:this.hudMap,transparent:true,depthWrite:false}));this.hud.position.set(0,-.6,-1.25);this.hud.renderOrder=11;
  this.reticle=new THREE.Mesh(new THREE.RingGeometry(.008,.012,24),new THREE.MeshBasicMaterial({color:0xefd75d,depthTest:false}));this.reticle.position.z=-1;this.reticle.renderOrder=20;
  renderer.xr.addEventListener('sessionend',()=>{this.rig.remove(camera);this.weapon.removeFromParent();this.hud.removeFromParent();this.reticle.removeFromParent();this.down=false;this.dwell.reset();this.session=null;onEnd();});
  for(let i=0;i<2;i++){
   const c=renderer.xr.getController(i);c.userData.connected=false;c.addEventListener('connected',e=>{c.userData.connected=true;c.userData.source=e.data;});c.addEventListener('disconnected',()=>{c.userData.connected=false;c.userData.source=null;this.down=false;});c.addEventListener('selectstart',()=>this.down=true);c.addEventListener('selectend',()=>this.down=false);
   const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-5)]),new THREE.LineBasicMaterial({color:0xefd75d}));c.add(line);this.rig.add(c);this.controllers.push(c);
  }
 }
 get active(){return this.renderer.xr.isPresenting;}
 async supported(){return !!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr');}
 async start(){
  const session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor']});this.session=session;
  try{await this.renderer.xr.setSession(session);this.rig.add(this.camera);this.camera.add(this.weapon,this.reticle);this.rig.add(this.hud);this.hud.position.y=1;this.camera.position.set(0,0,0);this.camera.rotation.set(0,0,0);}catch(e){await session.end();throw e;}
 }
 async end(){await this.session?.end();}
 attach(world){
  this.world=world;world.scene.add(this.rig);for(const m of this.markers){m.removeFromParent();m.geometry.dispose();m.material.dispose();}this.markers=[];
  for(const [i,p]of world.teleports.entries()){
   if(!validPoint(p,world.bounds,world.obstacles,.7))continue;
   const marker=new THREE.Mesh(new THREE.CylinderGeometry(.8,.8,.06,32),new THREE.MeshBasicMaterial({color:0x59e0cb,transparent:true,opacity:.6}));marker.position.set(p.x,world.floorY+.08,p.z);marker.userData.teleport={...p,id:i};world.scene.add(marker);this.markers.push(marker);
  }
 }
 aim(ray){const controller=this.controllers.find(c=>c.userData.connected&&c.userData.source?.handedness==='right')||this.controllers.find(c=>c.userData.connected);const c=this.active?(controller||this.renderer.xr.getCamera()):this.camera;ray.set(c.getWorldPosition(new THREE.Vector3()),new THREE.Vector3(0,0,-1).applyQuaternion(c.getWorldQuaternion(new THREE.Quaternion())));}
 sample(state){
  if(!this.active)return state;const pads=[...(this.session?.inputSources||[])].map(s=>s.gamepad).filter(Boolean);const right=pads.at(-1),left=pads[0];
  const buttons={reload:!!right?.buttons[4]?.pressed,switch:!!right?.buttons[1]?.pressed,pause:!!right?.buttons[5]?.pressed};
  for(const [k,v]of Object.entries(buttons)){state.pressed[k]=state.pressed[k]||v&&!this.previous[k];}this.previous=buttons;
  state.fire=state.fire||this.down||!!right?.buttons[0]?.pressed;state.moveX=left?.axes[2]||state.moveX;state.moveY=left?.axes[3]||state.moveY;state.lookX=0;state.lookY=0;state.mouseX=state.mouseY=0;return state;
 }
 sync(sim,world){if(!this.active){this.rig.position.set(0,0,0);this.rig.rotation.set(0,0,0);return;}this.rig.position.set(sim.player.x,world.floorY,sim.player.z);this.rig.rotation.y=sim.yaw;this.camera.position.set(0,0,0);this.camera.rotation.set(0,0,0);this.rig.updateMatrixWorld(true);this.renderer.xr.updateCamera(this.camera);}
 update(dt,sim,mode,teleportPressed=false){
  for(const m of this.markers){m.visible=mode==='playing'&&sim.teleportCooldown<=0&&Math.hypot(m.position.x-sim.player.x,m.position.z-sim.player.z)>2;}
  this.aim(this.ray);this.ray.far=100;
  let target=null;const marker=this.ray.intersectObjects(this.markers.filter(m=>m.visible),false)[0];
  if(marker){const wall=this.ray.intersectObjects(this.world.staticMeshes,false)[0];if(!wall||wall.distance>=marker.distance-.2)target=marker.object;}
  if(this.active){
   const hit=this.ray.intersectObject(this.hud,false)[0];if(hit?.uv&&hit.uv.y<.48){const i=Math.min(5,Math.floor(hit.uv.x*6));target=`button:${i}`;}
   if(this.dwell.update(target,dt,typeof target==='string'?.67:1)){if(typeof target==='string'){this.onAction(['switch','reload','perk','pause','resume','exit'][Number(target.split(':')[1])]);}else if(target)sim.teleport(target.userData.teleport);}
   this.reticle.scale.setScalar(1+Math.min(this.dwell.time,1)*.6);this.updateHUD(sim,mode);this.weaponMap.needsUpdate=true;this.weapon.visible=mode==='playing';
  }else if(target&&teleportPressed)sim.teleport(target.userData.teleport);
  return {target:target?.userData?.teleport?.id??null};
 }
 updateHUD(sim,mode){const c=this.hudCanvas.getContext('2d');c.clearRect(0,0,1024,256);c.fillStyle='rgba(10,18,25,.9)';c.fillRect(0,0,1024,256);c.fillStyle='#fff';c.font='30px sans-serif';c.textAlign='center';c.fillText(`${mode.toUpperCase()}   HEALTH ${Math.ceil(sim.player.health)}   ${sim.weapon.name}   ${sim.weapon.melee?'∞':Math.floor(sim.ammo[sim.weaponIndex])}   ${sim.score} PT`,512,60);c.font='26px sans-serif';['SWITCH','RELOAD','SPECIAL','PAUSE',mode==='over'?'RESTART':'RESUME','EXIT VR'].forEach((s,i)=>{c.strokeStyle='#efd75d';c.strokeRect(i*1024/6+4,140,1024/6-8,92);c.fillText(s,(i+.5)*1024/6,194);});this.hudMap.needsUpdate=true;}
}
