import * as THREE from 'three';
export class DefeatPresentation{
 constructor(camera){this.camera=camera;this.voices=new Map();this.age=0;this.active=false;}
 start(sim,clip){this.stop();this.active=true;this.clip=clip;this.age=0;this.position=this.camera.position.clone();this.rotation=this.camera.quaternion.clone();this.yaw=sim.yaw;}
 stop(){for(const {source,gain} of this.voices.values()){source.stop();source.disconnect();gain.disconnect();}this.voices.clear();this.active=false;}
 update(dt,sim,{audio,buffers,volume,vr=false}){
  if(!this.active)return;this.age+=dt;
  if(!vr&&this.clip){const f=this.clip.frames.find(f=>f.time>=Math.min(this.age,this.clip.duration))||this.clip.frames.at(-1),offset=new THREE.Vector3(...f.position).applyAxisAngle(new THREE.Vector3(0,1,0),this.yaw);this.camera.position.copy(this.position).add(offset);this.camera.position.y=Math.max((sim.floorY||0)+.3,this.camera.position.y);this.camera.quaternion.copy(this.rotation).multiply(new THREE.Quaternion(...f.rotation).normalize());this.camera.fov=65;this.camera.updateProjectionMatrix();}
  const alive=sim.enemies.filter(e=>e.health>0);
  for(const e of alive){if(e.victoryDelay>0)continue;const key=e.type+'Laugh',buffer=buffers[key]||buffers.crowdLaugh;if(!audio||!buffer||this.voices.has(e.id))continue;const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=buffer;source.loop=true;source.connect(gain);gain.connect(audio.destination);source.start();this.voices.set(e.id,{source,gain,enemy:e});}
  for(const {gain,enemy} of this.voices.values()){const distance=Math.hypot(enemy.x-sim.player.x,enemy.z-sim.player.z);gain.gain.value=volume*.6/Math.sqrt(Math.max(1,alive.length))/(1+distance/20);}
 }
}
