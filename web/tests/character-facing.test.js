import test from 'node:test';
import assert from 'node:assert/strict';
import {characterFacing} from '../src/character-roster.js';
test('zombie holds its facing through fake death and recovery as player circles it',()=>{
 const enemy={type:'zombie',x:0,z:0,heading:1.2,animation:'run',state:'down'};
 const facing=1.2;
 for(const [state,animation] of [['down','run'],['down','knockdown'],['rise','knockdown'],['rise','recover'],['pursue','recover']]){
  Object.assign(enemy,{state,animation});
  for(const player of [{x:10,z:0},{x:0,z:-10},{x:-10,z:0}])assert.equal(characterFacing(enemy,player,facing),facing);
 }
 Object.assign(enemy,{state:'pursue',animation:'run',heading:-.7});assert.equal(characterFacing(enemy,{x:10,z:0},facing),-.7);
 enemy.animation='idle';assert.equal(characterFacing(enemy,{x:10,z:0},facing),Math.PI/2);
 enemy.animation='death';assert.equal(characterFacing(enemy,{x:10,z:0},facing),facing);
});
