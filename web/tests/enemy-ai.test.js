import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';import {createEnemy,ENEMY_TYPES,enter,waveTypes} from '../src/enemy-ai.js';import {clearSegment,EnemyNavigation,validPoint} from '../src/enemy-navigation.js';
const input=()=>({moveX:0,moveY:0,lookX:0,lookY:0,mouseX:0,mouseY:0,pressed:{}});
function setup(type,pos={x:0,z:-12},options={}){const s=new Simulation({random:()=>.4,...options});s.nextWave=999;const e=createEnemy(type,pos,'enemy');s.enemies=[e];return {s,e};}
function step(s,seconds){for(let t=0;t<seconds;t+=.05)s.update(.05,input());}
test('melee has a windup and rechecks distance and scenery at impact',()=>{
 const {s,e}=setup('grunt',{x:0,z:-1.8});step(s,.1);assert.equal(s.player.health,100);assert.equal(e.state,'windup');s.player.z=6;step(s,.6);assert.equal(s.player.health,100);
 const blocked=setup('strong',{x:0,z:-2},{obstacles:[{minX:-5,maxX:5,minZ:-1.1,maxZ:-.9}]});step(blocked.s,2);assert.equal(blocked.s.player.health,100);
});
test('enemies use cover and collision-safe routes instead of pushing into walls',()=>{
 const obstacles=[{minX:-2,maxX:2,minZ:-7,maxZ:-5}],bounds={minX:-20,maxX:20,minZ:-20,maxZ:20};
 const nav=new EnemyNavigation(bounds,obstacles),start={x:0,z:-12},goal={x:0,z:0},route=nav.route(start,goal);assert.ok(route.length>1);
 let prev=start;for(const p of route){assert.ok(clearSegment(prev,p,obstacles,.65));prev=p;}
 const {s,e}=setup('grunt',start,{obstacles,bounds,coverPoints:[{x:6,z:-10}]});step(s,1);assert.ok(e.x>0);assert.equal(e.state,'patrol');
 step(s,8);assert.ok(validPoint(e,bounds,obstacles));assert.ok(e.age>8);
});
test('ranged enemies throw visible, dodgeable projectiles then move to new cover',()=>{
 for(const type of ['chicken','fish','soldier']){
  const {s,e}=setup(type,{x:0,z:-15},{coverPoints:[{x:6,z:-10},{x:-6,z:-10}]});step(s,1.2);assert.ok(s.projectiles.length>0,type);assert.equal(s.player.health,100);
  s.player.x=12;step(s,1.2);assert.equal(s.player.health,100,'moving avoids the locked throw');step(s,5);assert.ok(Math.abs(e.x)>0||e.state==='roll');
 }
});
test('projectiles stop at scenery and deal damage only when they land',()=>{
 const {s}=setup('fish');step(s,1.2);assert.equal(s.player.health,100);step(s,1.5);assert.ok(s.player.health<100);
 const b=setup('fish');step(b.s,1.2);b.s.obstacles.push({minX:-20,maxX:20,minZ:-5,maxZ:-4});step(b.s,2);assert.equal(b.s.player.health,100);
});
test('bomber can be interrupted and detonates once without kill rewards',()=>{
 const {s,e}=setup('bomber',{x:0,z:-2});step(s,.2);assert.equal(e.state,'fuse');step(s,1);assert.equal(s.player.health,78);assert.equal(s.score,0);assert.equal(s.corpses.length,1);step(s,1);assert.equal(s.player.health,78);
 const b=setup('bomber',{x:0,z:-2});step(b.s,.2);b.s.damageEnemy(b.e,1000);step(b.s,1);assert.equal(b.s.player.health,100);assert.equal(b.s.score,135);assert.equal(b.s.money,35);
});
test('zombie falls, rises faster and awards a kill only on its final death',()=>{
 const {s,e}=setup('zombie');s.damageEnemy(e,1000);assert.equal(e.state,'down');assert.equal(s.score,0);step(s,3.2);assert.equal(e.revives,0);assert.ok(e.speed>ENEMY_TYPES.zombie.speed);s.damageEnemy(e,1000);assert.equal(s.score,100);assert.equal(s.corpses.length,1);
});
test('runner accelerates on hit; strong puppet stays slower and tougher',()=>{
 const f=setup('fast');f.s.damageEnemy(f.e,1);assert.equal(f.e.state,'stagger');step(f.s,1.1);assert.equal(f.e.speed,ENEMY_TYPES.fast.sprint);assert.ok(ENEMY_TYPES.strong.health>f.e.maxHealth);assert.ok(ENEMY_TYPES.strong.speed<f.e.speed);
});
test('ninja jumps, trash hides in place, magician changes size and relocates safely',()=>{
 const n=setup('ninja');n.e.special=0;step(n.s,.2);assert.equal(n.e.state,'jump');assert.ok(n.e.y>0);
 const t=setup('trash');step(t.s,.2);assert.equal(t.e.hidden,true);step(t.s,2);assert.equal(t.e.x,0);assert.equal(t.e.z,-12);
 const m=setup('magician');m.e.special=0;step(m.s,1.5);assert.ok(m.e.magicScale!==1);step(m.s,1.2);assert.ok(m.e.x!==0);assert.ok(validPoint(m.e,m.s.bounds,m.s.obstacles));
});
test('vampire alternates forms, bosses shield/charge and kart disengages',()=>{
 const v=setup('vampire');v.e.special=0;step(v.s,1.3);assert.equal(v.e.form,'bat');assert.ok(v.e.y>0);v.e.special=0;step(v.s,1.3);assert.equal(v.e.form,'puppet');
 for(const type of ['boss','clown']){const b=setup(type);b.e.special=0;step(b.s,.15);assert.ok(b.e.shield);const health=b.e.health;b.s.damageEnemy(b.e,100);assert.equal(b.e.health,health);}
 const k=setup('kart',{x:0,z:-2},{coverPoints:[{x:10,z:-12}]});step(k.s,1.9);assert.equal(k.e.state,'escape');const z=k.e.z;step(k.s,.5);assert.ok(k.e.z<z);
});
test('all archetypes are reachable in waves, remain finite, and reset clears effects',()=>{
 const available=new Set(Array.from({length:20},(_,i)=>waveTypes(i+1)).flat());for(const type of Object.keys(ENEMY_TYPES)){assert.ok(available.has(type));const {s,e}=setup(type);step(s,20);assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.z)&&Number.isFinite(s.player.health),type);s.reset();assert.equal(s.projectiles.length,0);assert.equal(s.effects.length,0);}
});

test('trash spawns only at designated anchors, including inside bin collision',()=>{
 const site={id:'bin-a',x:10,z:-12};const s=new Simulation({trashSpawnPoints:[site],obstacles:[{minX:9,maxX:11,minZ:-13,maxZ:-11}],random:()=>.5});
 assert.equal(s.spawnTrash(),true);const e=s.enemies[0];assert.equal(e.x,site.x);assert.equal(e.z,site.z);assert.equal(e.siteId,site.id);assert.equal(s.spawnTrash(),false);
 const empty=new Simulation();assert.equal(empty.spawnTrash(),false);
 for(let wave=3;wave<8;wave++){empty.wave=wave-1;empty.spawnWave();assert.ok(empty.enemies.every(e=>e.type!=='trash'));}
});
test('trash stays anchored after hits, cake lures and a nearby player',()=>{
 const s=new Simulation({trashSpawnPoints:[{x:0,z:-1}],random:()=>.5});s.nextWave=999;s.spawnTrash();const e=s.enemies[0];e.hidden=false;s.damageEnemy(e,1);step(s,1.2);assert.notEqual(e.state,'windup');
 s.cakes.push({id:5,x:10,z:10,y:.3,landed:true,fuse:8,age:0});step(s,2);assert.equal(e.x,0);assert.equal(e.z,-1);assert.notEqual(e.animation,'run');
});
test('trash encounters trigger independently in both modes at the nearest designated site',()=>{
 for(const encounterMode of ['expanded','vr']){const s=new Simulation({encounterMode,trashSpawnPoints:[{id:'far',x:30,z:30},{id:'near',x:0,z:-12}],random:()=>.99});s.kills=12;s.nextWave=999;step(s,.1);const trash=s.enemies.find(e=>e.type==='trash');assert.ok(trash);assert.equal(trash.siteId,'near');step(s,3);assert.equal(s.enemies.filter(e=>e.type==='trash').length,1);assert.ok(s.events.includes('enemyShot'));}
});
test('distant trash is not permanently invisible and cannot block expanded waves',()=>{
 const s=new Simulation({trashSpawnPoints:[{x:0,z:-35}]});s.spawnTrash();s.nextWave=.01;step(s,.7);assert.ok(s.wave>0);const e=s.enemies.find(e=>e.type==='trash');assert.ok(e&&!e.hidden);assert.ok(s.enemies.some(e=>e.type!=='trash'));
});
