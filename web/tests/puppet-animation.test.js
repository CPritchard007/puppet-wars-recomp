import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createPuppetTemplate } from '../src/puppet-animation.js';
const rig=JSON.parse(readFileSync(new URL('../public/assets/puppet-rig.json',import.meta.url)));
function template(){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(rig.geometry.positions,3));g.setIndex(rig.geometry.indices);
  return createPuppetTemplate(rig,g,[new THREE.MeshBasicMaterial()]);
}
function points(actor){return Array.from({length:actor.mesh.geometry.attributes.position.count},(_,i)=>actor.mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(actor.mesh.matrixWorld).toArray());}
function difference(a,b){return a.reduce((sum,p,i)=>sum+p.reduce((s,v,j)=>s+Math.abs(v-b[i][j]),0),0);}
test('original skin has normalized weights, bound tracks and finite grounded ready pose',()=>{
 const t=template(),a=t.create(0);assert.equal(a.skeleton.bones.length,24);
 for(let i=0;i<rig.geometry.skinWeights.length;i+=4)assert.ok(Math.abs(rig.geometry.skinWeights.slice(i,i+4).reduce((a,b)=>a+b,0)-1)<.001);
 const p=points(a);assert.ok(p.flat().every(Number.isFinite));const ys=p.map(v=>v[1]);assert.ok(Math.abs(Math.min(...ys))<.001);assert.ok(Math.abs(Math.max(...ys)-3.3)<.001);
 assert.equal(a.state,'idle');a.dispose();t.geometry.dispose();t.materials[0].dispose();
});
test('original run clip deforms skin and each puppet has independent bones',()=>{
 const t=template(),a=t.create(0),b=t.create(0);const before=points(a),other=points(b);
 a.play('run',0);a.update(.2);const after=points(a);
 assert.ok(difference(before,after)>1,'vertices must deform, not only translate the whole model');assert.deepEqual(points(b),other);assert.notEqual(a.skeleton.bones[0],b.skeleton.bones[0]);
 // World placement and rotation must also preserve a compact, valid skin.
 a.position.set(20,0,-30);a.rotation.y=1.1;a.update(.1);const box=new THREE.Box3().setFromPoints(points(a).map(p=>new THREE.Vector3(...p)));assert.ok(box.getSize(new THREE.Vector3()).length()<7);
 a.dispose();b.dispose();t.geometry.dispose();t.materials[0].dispose();
});
test('attack, hit and death clips change pose; death clamps and cannot return to running',()=>{
 const t=template(),a=t.create(0);a.play('attack',0);a.update(.25);const attack=points(a);a.update(.25);assert.ok(difference(attack,points(a))>.1);
 a.update(.1,'run',1);assert.equal(a.state,'hit');a.update(.1,'run',1);assert.equal(a.state,'hit');a.update(.5,'run',1);a.update(.01,'run',1);assert.equal(a.state,'run');
 a.update(.2,'death');assert.equal(a.state,'death');a.update(2,'run');assert.equal(a.state,'death');assert.ok(a.oneShotComplete);const end=points(a);a.update(1,'attack');assert.ok(difference(end,points(a))<.0001);a.dispose();a.dispose();t.geometry.dispose();t.materials[0].dispose();
});
test('celebration animates menu characters immediately rather than showing bind pose',()=>{
 const t=template(),a=t.create(0);a.play('celebrate',0);a.update(0);const first=points(a);a.update(.3);assert.ok(difference(first,points(a))>1);a.dispose();t.geometry.dispose();t.materials[0].dispose();
});
