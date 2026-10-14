import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {EXTRA_WEAPONS} from '../src/extra-weapons.js';import {Simulation,WEAPONS} from '../src/simulation.js';import {weaponFrame} from '../src/weapon-animation.js';import {vrSurvivalPhase} from '../src/vr-content.js';
const clips=JSON.parse(readFileSync(new URL('../public/assets/extra-weapons/animations.json',import.meta.url)));
test('added weapons have complete original frames and both Uzi hands share action timing',()=>{
 for(const w of EXTRA_WEAPONS){const c=clips[w.id];assert.ok(c.idle.length);assert.ok(c.fire.length);assert.equal(c.idleLoopReverse,true);if(!w.melee)assert.ok(c.reload.length);for(const hand of [c,...(c.left?[c.left]:[])])for(const frames of Object.values(hand).filter(Array.isArray))for(const f of frames)assert.ok(existsSync(new URL('../public/'+f.texture,import.meta.url)));}
 const sim=new Simulation({startingWeapon:9});sim.shot();for(const t of [0,.1,.5]){sim.fireAge=t;assert.equal(weaponFrame(clips.dualuzis,sim).state,weaponFrame(clips.dualuzis.left,sim).state);}assert.equal(WEAPONS[9].pellets,2);assert.equal(WEAPONS[9].dual,true);
});
test('snow encounters include elf immediately and retain original Christmas roster',()=>{
 for(const n of [0,15,45,100]){const p=vrSurvivalPhase('snow',n);assert.ok(p.types.includes('elf'));assert.ok(!p.types.includes('vampire'));}
 const s=new Simulation({arena:{key:'snow'},random:()=>.8});s.spawnWave();assert.ok(s.waveQueue.some(e=>e.type==='elf'));
});
test('bat and axe use delayed area hits and do not spend ammo',()=>{
 for(const id of ['bat','axe']){const s=new Simulation({startingWeapon:WEAPONS.findIndex(w=>w.id===id)});assert.ok(s.shot());assert.equal(s.pendingAttacks[0].kind,'melee');assert.equal(s.pendingAttacks[0].weapon.id,id);assert.equal(s.ammo[s.weaponIndex],0);s.reload();assert.equal(s.reloading,0);}
});
test('sniper preserves recovered base stats and scope yields to reload',()=>{
 const w=WEAPONS.find(w=>w.id==='sniper');assert.equal(w.capacity,10);assert.equal(w.damage,150);assert.equal(w.interval,.8);assert.equal(w.scopeFov,10);
 const s=new Simulation({startingWeapon:WEAPONS.indexOf(w)});assert.ok(s.shot());assert.equal(s.ammo[s.weaponIndex],9);s.scopeAge=.2;assert.equal(weaponFrame(clips.sniper,s).state,'scope');s.scopeAge=.6;assert.equal(weaponFrame(clips.sniper,s).state,'scopeAim');s.reload();assert.equal(weaponFrame(clips.sniper,s).state,'reload');
});
