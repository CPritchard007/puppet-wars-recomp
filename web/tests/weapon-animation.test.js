import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {weaponFrame} from '../src/weapon-animation.js';import {Simulation} from '../src/simulation.js';
const clips=JSON.parse(readFileSync(new URL('../public/assets/weapons/animations.json',import.meta.url)));
test('all original reload stages and shotgun pump play in order',()=>{
 for(const index of [0,1]){const s=new Simulation();s.weaponIndex=index;s.ammo[index]--;s.reload();const textures=new Set();
  for(let t=0;t<s.weapon.reload;t+=.03){s.reloading=s.weapon.reload-t;const f=weaponFrame(clips[index],s);assert.equal(f.state,'reload');textures.add(f.texture);}assert.equal(textures.size,index===0?3:4);
 }
 const s=new Simulation();s.weaponIndex=1;s.shot();s.fireAge=.4;assert.match(weaponFrame(clips[1],s).texture,/Fire 01/);
});
test('mop cycles into loadout, swings and recovers without ammo or reload',()=>{
 const s=new Simulation();s.switchWeapon();s.switchWeapon();assert.equal(s.weapon.name,'MOP');s.cooldown=0;assert.ok(s.shot());assert.equal(s.ammo[2],0);s.reload();assert.equal(s.reloading,0);
 s.fireAge=.2;assert.match(weaponFrame(clips[2],s).texture,/MOP Fire/);s.fireAge=.9;assert.match(weaponFrame(clips[2],s).texture,/AfterFire/);s.fireAge=2;assert.equal(weaponFrame(clips[2],s).state,'idle');s.switchWeapon();assert.equal(s.weapon.name,'AK-47');
});

test('all recovered animated idles reverse smoothly at both ends',()=>{
 const vr=JSON.parse(readFileSync(new URL('../public/assets/vr/weapons/animations.json',import.meta.url)));
 const all=[...clips,...Object.values(vr)];assert.equal(all.length,9);
 for(const c of all){
  const s=new Simulation();s.fireAge=null;const n=c.idle.length;
  if(n===1){s.time=100;assert.equal(weaponFrame(c,s).index,0);continue;}
  assert.equal(c.idleLoopReverse,true);
  const order=[...Array(n).keys(),...Array.from({length:n-2},(_,i)=>n-2-i)];
  let time=0;const sampled=[];
  for(let repeat=0;repeat<3;repeat++)for(const index of order){s.time=time+c.idle[index].duration/2;sampled.push(weaponFrame(c,s).index);assert.equal(sampled.at(-1),index);time+=c.idle[index].duration;}
  for(let i=1;i<sampled.length;i++)assert.equal(Math.abs(sampled[i]-sampled[i-1]),1,'no last-to-first teleport');
 }
});
