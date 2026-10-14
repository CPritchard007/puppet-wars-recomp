import * as THREE from 'three';

// World-space effects accompany the recovered first-person sprite animation.
// They are emitted only after Simulation.shot accepts an attack.
export class WeaponEffects {
 constructor(scene,flameMap){this.scene=scene;this.flameMap=flameMap;this.items=[];this.geometry=new THREE.CylinderGeometry(.025,.025,1,5);this.ray=new THREE.Raycaster();}
 emit(weapon,aim,wallMeshes,enemyMeshes=[],muzzlePosition=null){
  // The original blower has no emitted cloud; its recovered sprite carries the firing effect.
  if(weapon.melee||weapon.perk||weapon.id==='leafblower')return;
  const direction=aim.direction.clone(),right=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(0,1,0)).normalize();
  const muzzle=aim.origin.clone().addScaledVector(direction,.8).addScaledVector(right,.3);muzzle.y-=.22;if(muzzlePosition)muzzle.copy(muzzlePosition);
  this.ray.set(aim.origin,direction);this.ray.far=weapon.range;
  const hit=this.ray.intersectObjects([...wallMeshes,...enemyMeshes],false)[0];
  const end=hit?.point.clone()||aim.origin.clone().addScaledVector(direction,weapon.range);
  if(weapon.id==='flamethrower'){
   for(let i=0;i<5;i++){
    const material=new THREE.SpriteMaterial({map:this.flameMap,color:0xffbc62,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending,rotation:Math.random()*Math.PI*2});
    const mesh=new THREE.Sprite(material);mesh.position.copy(muzzle);mesh.scale.setScalar(.14);this.scene.add(mesh);
    const velocity=end.clone().sub(muzzle).normalize().addScaledVector(right,(Math.random()-.5)*.2);velocity.y+=(Math.random()-.5)*.15;velocity.normalize().multiplyScalar(28+Math.random()*6);
    this.items.push({mesh,kind:'flame',velocity,age:i*.008,life:Math.min(.85,weapon.range/32),origin:muzzle.clone(),range:weapon.range});
   }
  }else{
   const mesh=new THREE.Mesh(this.geometry,new THREE.MeshBasicMaterial({color:0xffed9a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));this.scene.add(mesh);
   this.items.push({mesh,kind:'tracer',origin:muzzle,end,direction:end.clone().sub(muzzle).normalize(),distance:muzzle.distanceTo(end),age:0,life:.24});
  }
  // Bound GPU resources even under sustained automatic fire.
  while(this.items.length>160)this.remove(this.items.shift());
 }
 remove(p){p.mesh.removeFromParent();p.mesh.material.dispose();}
 update(dt,walls){
  this.items=this.items.filter(p=>{
   p.age+=dt;
   if(p.age>=p.life){this.remove(p);return false;}
   if(p.kind==='tracer'){
    const head=Math.min(p.distance,p.age*700),tail=Math.max(0,head-5),length=head-tail;
    p.mesh.position.copy(p.origin).addScaledVector(p.direction,(head+tail)/2);p.mesh.scale.set(1,Math.max(.01,length),1);p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),p.direction);p.mesh.material.opacity=1-p.age/p.life;
   }else{
    const step=p.velocity.length()*dt;this.ray.set(p.mesh.position,p.velocity.clone().normalize());this.ray.far=step;
    if(this.ray.intersectObjects(walls,false).length){this.remove(p);return false;}
    p.mesh.position.addScaledVector(p.velocity,dt);if(p.mesh.position.distanceTo(p.origin)>p.range){this.remove(p);return false;}
    p.mesh.scale.setScalar(.14+p.age*3.4);p.mesh.material.opacity=.7*(1-p.age/p.life);p.mesh.material.rotation+=dt;
   }return true;
  });
 }
 snapshot(){return this.items.reduce((counts,p)=>(counts[p.kind]=(counts[p.kind]||0)+1,counts),{});}
 dispose(){for(const p of this.items)this.remove(p);this.items=[];this.geometry.dispose();}
}
