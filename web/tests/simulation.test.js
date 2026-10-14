import test from 'node:test';import assert from 'node:assert/strict';
import { Simulation,moveBody,WEAPONS } from '../src/simulation.js';
const neutral=()=>({moveX:0,moveY:0,lookX:0,lookY:0,mouseX:0,mouseY:0,pressed:{}});
test('reload conserves ammunition and cannot switch mid reload',()=>{const s=new Simulation();s.nextWave=999;s.ammo[0]=12;s.reserve[0]=5;s.reload();s.switchWeapon();assert.equal(s.weaponIndex,0);for(let i=0;i<45;i++)s.update(.05,neutral());assert.equal(s.ammo[0],17);assert.equal(s.reserve[0],0);assert.equal(s.reloading,0);});
test('fire rate limits ammunition use and empty magazines auto reload',()=>{const s=new Simulation();s.ammo[0]=1;assert.ok(s.shot());assert.equal(s.ammo[0],0);assert.equal(s.shot(),false);for(let i=0;i<15;i++)s.update(.05,neutral());assert.equal(s.shot(),false);assert.equal(s.reloading,WEAPONS[0].reload);});
test('collision substeps prevent walking through thin walls',()=>{const body={x:0,z:0};moveBody(body,15,3,{minX:-20,maxX:20,minZ:-20,maxZ:20},[{minX:2,maxX:2.1,minZ:-5,maxZ:5}]);assert.ok(body.x<2);assert.ok(body.z>2.9);});
test('kills award score only once and create supplies',()=>{const s=new Simulation();for(let i=0;i<3;i++){const e={health:10,x:0,z:0};s.damageEnemy(e,20);s.damageEnemy(e,20);}assert.equal(s.score,300);assert.equal(s.kills,3);assert.equal(s.pickups.filter(p=>p.kind==='ammo').length,1);assert.equal(s.pickups.filter(p=>p.kind==='money').length,3);});
test('death terminates simulation and movement',()=>{const s=new Simulation();s.player.health=1;s.enemies=[{health:10,x:0,z:0,attack:0,flash:0,speed:3}];for(let i=0;i<14;i++)s.update(.05,neutral());assert.ok(s.ended);const before=s.time;s.update(.05,neutral());assert.equal(s.time,before);});
test('wave spawning avoids obstacles and immediate player contact',()=>{const s=new Simulation({random:()=>.8});s.spawnWave();assert.equal(s.wave,1);assert.equal(s.enemies.length,6);for(const e of s.enemies)assert.ok(Math.hypot(e.x,e.z)>12);});

test('spawn validator prevents enemies appearing behind inaccessible scenery',()=>{const s=new Simulation({canSpawn:()=>false});s.spawnWave();assert.equal(s.enemies.length,0);});

test('dead puppets become temporary noncombat corpses and cannot award duplicate kills',()=>{
 const s=new Simulation();s.nextWave=999;const enemy={id:'test',health:10,x:4,z:4,attack:0,flash:0,speed:3};s.enemies.push(enemy);
 s.damageEnemy(enemy,20);s.damageEnemy(enemy,20);assert.equal(s.corpses.length,1);assert.equal(s.corpses[0].animation,'death');assert.equal(s.kills,1);
 s.update(.05,neutral());assert.equal(s.enemies.length,0);assert.equal(s.player.health,100);assert.equal(s.corpses.length,1);
 for(let i=0;i<56;i++)s.update(.05,neutral());assert.equal(s.corpses.length,0);
});
