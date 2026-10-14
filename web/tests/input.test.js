import test from 'node:test';
import assert from 'node:assert/strict';
import { deadzone, gamepadState, PROFILES } from '../src/input.js';
const pad=(axes=[],pressed=[])=>({axes,buttons:Array.from({length:17},(_,i)=>({pressed:pressed.includes(i),value:pressed.includes(i)?1:0}))});
test('original 0.19 deadzone rejects drift and scales to full deflection',()=>{assert.equal(deadzone(.18),0);assert.equal(deadzone(-.19),0);assert.equal(deadzone(1),1);assert.equal(deadzone(-1),-1);assert.equal(deadzone(NaN),0);assert.ok(Math.abs(deadzone(.595)-.5)<1e-9);});
test('standard pad moves, looks, fires and aims independently',()=>{const s=gamepadState(pad([1,-1,.5,-.5],[6,7,2]));assert.equal(s.moveX,1);assert.equal(s.moveY,-1);assert.ok(s.lookX>0);assert.ok(s.lookY<0);assert.ok(s.fire&&s.aim&&s.reload);assert.equal(s.jump,false);});
test('legacy buttons retain InputManager fire1/fire2/fire3/jump assignments',()=>{for(const [button,action]of [[0,'fire'],[1,'aim'],[2,'reload'],[3,'jump']])assert.equal(gamepadState(pad([],[button]),PROFILES.legacy)[action],true);});
test('custom nonstandard device can remap buttons and axes with inverted look',()=>{const s=gamepadState(pad([0,0,-1,0,1,1],[4]),{...PROFILES.standard,fire:4,moveX:2,lookY:5},{invertY:true});assert.equal(s.fire,true);assert.equal(s.moveX,-1);assert.equal(s.lookY,-1);});
test('missing and disconnected controllers return neutral input',()=>{for(const p of [null,{},pad()]){const s=gamepadState(p);assert.equal(s.moveX,0);assert.equal(s.lookY,0);assert.equal(s.fire,false);}});
