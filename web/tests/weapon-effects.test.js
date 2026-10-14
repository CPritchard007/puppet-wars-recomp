import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {WeaponEffects} from '../src/weapon-effects.js';import {VR_WEAPONS} from '../src/vr-content.js';
const aim=new THREE.Ray(new THREE.Vector3(0,2,0),new THREE.Vector3(0,0,-1));
test('accepted shots create world effects and expire without leaking scene objects',()=>{
 const scene=new THREE.Scene(),fx=new WeaponEffects(scene,new THREE.Texture());
 fx.emit(VR_WEAPONS[0],aim,[]);assert.equal(fx.snapshot().tracer,1);
 fx.emit(VR_WEAPONS[1],aim,[]);assert.equal(fx.snapshot().flame,5);
 fx.emit(VR_WEAPONS[3],aim,[]);assert.equal(fx.snapshot().air,undefined);
 fx.emit(VR_WEAPONS[2],aim,[]);assert.equal(scene.children.length,6);
 fx.update(1,[]);assert.equal(scene.children.length,0);fx.dispose();
});
test('tracers stop at the first wall and flame particles cannot pass through it',()=>{
 const scene=new THREE.Scene(),fx=new WeaponEffects(scene,new THREE.Texture()),wall=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));wall.position.set(0,2,-2);wall.updateMatrixWorld();
 fx.emit(VR_WEAPONS[0],aim,[wall]);assert.ok(Math.abs(fx.items[0].end.z+2)<.001);
 fx.emit(VR_WEAPONS[1],aim,[wall]);fx.update(.1,[wall]);assert.equal(fx.snapshot().flame,undefined);fx.dispose();
});
test('blower emits no invented smoke cloud and flames originate at the supplied muzzle',()=>{
 const flame=new THREE.Texture(),fx=new WeaponEffects(new THREE.Scene(),flame),muzzle=new THREE.Vector3(2,3,-4);
 fx.emit(VR_WEAPONS[3],aim,[],[],muzzle);assert.equal(fx.items.length,0);
 fx.emit(VR_WEAPONS[1],aim,[],[],muzzle);assert.equal(fx.items.at(-1).mesh.material.map,flame);assert.ok(fx.items.at(-1).origin.equals(muzzle));fx.dispose();
});
test('screen muzzle tracks weapon scale across desktop and phone aspect ratios',async()=>{
 const {muzzlePixel,weaponLayout}=await import('../src/weapon-layout.js');
 for(const [w,h] of [[1440,900],[2560,1080],[844,390]]){const p=muzzlePixel('leafblower',w,h),l=weaponLayout(w,h);assert.ok(Math.abs((p.x-w/2)/l.halfW-.14)<1e-8);assert.ok(Math.abs((p.y-l.baseY)/l.halfH-.405)<1e-8);}
});
