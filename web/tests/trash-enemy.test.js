import test from 'node:test';import assert from 'node:assert/strict';import {Simulation} from '../src/simulation.js';import {updateEnemy,createEnemy} from '../src/enemy-ai.js';import {TRASH_ATTACK,townTrashSites} from '../src/trash-enemy.js';import {characterFacing} from '../src/character-roster.js';
function fixture(){const s=new Simulation({trashSpawnPoints:[{x:0,y:1,z:-20}],random:()=>.5});s.floorY=-.2;s.spawnTrash();return {s,e:s.enemies[0]};}
function advance(s,e,t){for(let i=0;i<Math.round(t/.01);i++)updateEnemy(s,e,.01,()=>{throw Error('Trash must not move');});}
test('trash completes its original four-shot animation and does not blink or stagger',()=>{
 const {s,e}=fixture();advance(s,e,.2);assert.equal(e.state,'trashShoot');assert.equal(e.y,1.2);assert.equal(e.hidden,false);const version=e.actionVersion;
 advance(s,e,.99);assert.equal(s.projectiles.length,0);advance(s,e,.01);assert.equal(s.projectiles.length,1);advance(s,e,.3);assert.equal(s.projectiles.length,2);advance(s,e,.5);assert.equal(s.projectiles.length,3);advance(s,e,.5);assert.equal(s.projectiles.length,4);
 s.damageEnemy(e,1);assert.equal(e.state,'trashShoot');assert.equal(e.actionVersion,version);assert.equal(e.hidden,false);advance(s,e,2.27);assert.equal(s.projectiles.length,4);assert.equal(e.state,'trashReady');advance(s,e,.01);assert.equal(e.actionVersion,version+1);assert.deepEqual([e.x,e.z],[0,-20]);assert.equal(TRASH_ATTACK.duration,4.566667);
});
test('trash burst uses a fixed firing direction, source launch origin and ballistic projectiles',()=>{
 const {s,e}=fixture();s.projectileOrigin=()=>({x:1,y:3,z:-19});advance(s,e,.2);s.player.x=15;advance(s,e,1);const p=s.projectiles[0];assert.deepEqual([p.x,p.y,p.z],[1,3,-19]);assert.equal(p.ballistic,true);assert.equal(p.vx,0);assert.equal(p.vz,10);assert.equal(p.vy,3);assert.equal(characterFacing(e,s.player,2),0);
});
test('trash death cancels pending releases and retains the bin anchor height',()=>{
 const {s,e}=fixture();advance(s,e,1.2);s.damageEnemy(e,1000);assert.equal(s.corpses.length,1);assert.equal(s.corpses[0].y,1.2);assert.equal(s.events.filter(e=>e==='trashDeath').length,1);assert.equal(s.corpses[0].animation,'death');
 const count=s.projectiles.length;s.nextWave=999;s.update(.05,{pressed:{},moveX:0,moveY:0,lookX:0,lookY:0,mouseX:0,mouseY:0});assert.equal(s.projectiles.length,count);assert.equal(s.enemies.length,0);
});
test('town selects source bins by player region and retains source elevation',()=>{
 assert.deepEqual(townTrashSites({x:0,z:0}),[[-15.7,1,-19],[26,1,-3.6],[-17.5,1,36.3]]);assert.equal(townTrashSites({x:0,z:100})[2][2],98);assert.equal(townTrashSites({x:-40,z:0})[0][0],-47);
});
