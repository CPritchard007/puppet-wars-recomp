import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,WEAPONS} from '../src/simulation.js';
import {createEnemy} from '../src/enemy-ai.js';
const setup=()=>{const s=new Simulation({startingWeapon:2});s.nextWave=999;return s;};
const enemy=(s,x,z,id)=>{const e=createEnemy('grunt',{x,z},id,1);e.health=200;s.enemies.push(e);return e;};
test('mop delays impact and sweeps multiple targets instead of a single bullet ray',()=>{
 const s=setup(),a=enemy(s,0,-4,'a'),b=enemy(s,1,-4,'b'),side=enemy(s,3,-3,'side'),behind=enemy(s,0,3,'behind'),far=enemy(s,0,-6,'far');
 assert.ok(s.shot());assert.equal(s.shot(),false);s.updateSpecials(.29);assert.equal(a.health,200);s.updateSpecials(.02);
 assert.equal(a.health,150);assert.equal(b.health,150);for(const e of [side,behind,far])assert.equal(e.health,200);
 assert.ok(s.events.includes('mopHit'));s.updateSpecials(1);assert.equal(a.health,150);assert.equal(s.ammo[2],0);
});
test('mop misses hidden targets and targets behind walls',()=>{
 const s=setup();s.obstacles.push({minX:-2,maxX:2,minZ:-3,maxZ:-2});const a=enemy(s,0,-4,'wall'),b=enemy(s,0,-1,'hidden');b.hidden=true;
 s.shot();s.updateSpecials(.31);assert.equal(a.health,200);assert.equal(b.health,200);assert.ok(s.events.includes('mopMiss'));
});
test('mop uses the supplied aim direction and source base weapon settings',()=>{
 const s=setup(),a=enemy(s,4,0,'right');s.shot();s.pendingAttacks.at(-1).direction={x:1,y:0,z:0};s.updateSpecials(.31);assert.equal(a.health,150);
 assert.equal(WEAPONS[2].range,5);assert.equal(WEAPONS[2].interval,.6);assert.equal(WEAPONS[2].damage,50);
});
