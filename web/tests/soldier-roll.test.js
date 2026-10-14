import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Simulation} from '../src/simulation.js';import {createEnemy} from '../src/enemy-ai.js';import {makeClips,characterFacing} from '../src/character-roster.js';
const input={moveX:0,moveY:0,lookX:0,lookY:0,mouseX:0,mouseY:0,pressed:{}};
function setup(obstacles=[]){const s=new Simulation({obstacles});s.nextWave=999;const e=createEnemy('soldier',{x:0,z:-10},'soldier');s.enemies=[e];s.damageEnemy(e,1);return {s,e};}
test('gunner roll ends at its new position and keeps moving from there',()=>{
 const {s,e}=setup();const start={x:e.x,z:e.z};let previous={...start};let facing=0;
 for(let i=0;i<30&&e.state==='roll';i++){s.yaw+=.5;s.update(.05,input);assert.ok(Math.hypot(e.x-previous.x,e.z-previous.z)<.2);previous={x:e.x,z:e.z};if(e.state==='roll'){facing=characterFacing(e,s.player,facing);assert.equal(facing,e.rollFacing);}}
 assert.equal(e.state,'patrol');assert.ok(Math.hypot(e.x-start.x,e.z-start.z)>3.9);
 const end={x:e.x,z:e.z};s.update(.05,input);assert.ok(Math.hypot(e.x-end.x,e.z-end.z)<.3);assert.ok(Math.hypot(e.x-start.x,e.z-start.z)>3.5);
});
test('gunner roll respects obstacles and does not restart when hit again',()=>{
 const {s,e}=setup([{minX:-3,maxX:-2,minZ:-12,maxZ:-8}]);s.update(.05,input);const timer=e.timer;s.damageEnemy(e,1);assert.equal(e.timer,timer);
 for(let i=0;i<23;i++)s.update(.05,input);assert.ok(e.x>=-1.35);
});
test('shoot-and-roll transitions to physical movement after its burst',()=>{
 const s=new Simulation();s.nextWave=999;const e=createEnemy('soldier',{x:0,z:-10},'soldier');e.state='throw';e.timer=0;e.shots=1;s.enemies=[e];s.update(.05,input);assert.equal(e.state,'roll');const before=e.x;s.update(.05,input);assert.notEqual(e.x,before);
});
test('roll clips no longer animate horizontal displacement or the return leg',()=>{
 const rig=JSON.parse(readFileSync(new URL('../public/assets/enemies/soldier.json',import.meta.url))),clips=makeClips(rig);
 assert.equal(clips.roll.duration,1.1);assert.equal(clips.throw.duration,1.5);
 for(const name of ['roll','throw']){const track=clips[name].tracks.find(t=>t.name==='bone_3.position');for(let i=0;i<track.values.length;i+=3){assert.equal(track.values[i],track.values[0]);assert.equal(track.values[i+2],track.values[2]);}}
 assert.equal(rig.clips.roll.duration,2.4333334,'keep recovered source untouched');
});
