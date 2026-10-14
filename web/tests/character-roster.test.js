import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as THREE from 'three';
import {RecoveredCharacter,makeClips,characterAnimation} from '../src/character-roster.js';import {ENEMY_TYPES} from '../src/enemy-ai.js';
const read=name=>JSON.parse(readFileSync(new URL('../public/assets/enemies/'+name,import.meta.url)));
function template(type){const rig=read(type+'.json');return {type,rig,clips:makeClips(rig),parts:rig.parts.map(p=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.geometry.positions,3));g.setIndex(p.geometry.indices);if(p.bones){g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(p.geometry.skinIndices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(p.geometry.skinWeights,4));}return {geometry:g,materials:p.materials.map(()=>new THREE.MeshBasicMaterial())};})};}
function cleanup(t,a){a.dispose();for(const p of t.parts){p.geometry.dispose();p.materials.forEach(m=>m.dispose());}}
test('every AI archetype has its own original model and bound finite animations',()=>{
 const manifest=read('manifest.json');for(const type of [...Object.keys(ENEMY_TYPES),'bat']){
  assert.ok(manifest.characters[type],type);const t=template(type),a=new RecoveredCharacter(t);a.setEnemyId(type);
  for(const [state,clip]of Object.entries(t.clips)){
   a.mixer.stopAllAction();a.state=null;a.play(state,0);a.update(Math.min(.35,clip.duration/2));
   for(const m of a.meshes){if(m.isSkinnedMesh){m.computeBoundingBox();assert.ok(Number.isFinite(m.boundingBox.min.y),`${type}/${state}`);}assert.equal(m.userData.enemyId,type);}
  }
  assert.ok(a.height>0&&a.height<9,type);cleanup(t,a);
 }
});
test('yellow runner is small; bomber and throwers use the correct original skins',()=>{
 const texture=type=>read(type+'.json').parts.flatMap(p=>p.materials.map(m=>m.sourceTexture));
 assert.ok(texture('fast').includes('puppetkid_UV_01yellow.png'));assert.equal(read('fast.json').height/read('grunt.json').height,.625);
 assert.ok(texture('bomber').includes('puppetkid_UV_01blueBomb.png'));assert.ok(texture('chicken').includes('puppetkid_UV_01purple.png'));assert.ok(texture('fish').includes('puppetkid_UV_01pink.png'));
});
test('pink fish thrower plays throw_short, moves its arm, and restarts on the next throw',()=>{
 const t=template('fish'),a=new RecoveredCharacter(t);const state=characterAnimation({state:'throw',animation:'attack'},a);assert.equal(state,'throw');a.update(.2,state,0,1);assert.equal(a.snapshot().source,'throw_short');const pose=a.snapshot().pose;a.update(.5,state,0,1);assert.notDeepEqual(a.snapshot().pose,pose);a.update(.05,'cover',0,1);assert.equal(a.state,'throw','finish throwing before taking cover');a.update(.05,state,0,2);assert.ok(a.actions.throw.time<.1);cleanup(t,a);
});
test('original fish and chicken projectiles have animated atlas frames',()=>{
 for(const type of ['fish','chicken','tomato']){const asset=read(type+'-projectile.json');assert.ok(asset.frames.length>=(type==='tomato'?1:2));assert.ok(asset.material.texture);assert.ok(asset.fps>0);for(const f of asset.frames)assert.ok(f.uv[2]>0&&f.uv[3]>0);}
});

 test('every enemy projectile type has an original textured asset',async()=>{const {ENEMY_TYPES}=await import('../src/enemy-ai.js');const manifest=JSON.parse(readFileSync(new URL('../public/assets/enemies/manifest.json',import.meta.url)));for(const p of Object.values(ENEMY_TYPES)){if(p.projectile){assert.ok(manifest.projectiles[p.projectile],p.projectile);}}});
