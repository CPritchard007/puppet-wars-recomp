import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.addInitScript(()=>{
  window.testPad={id:'Generic test gamepad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{value:()=>window.testPad?[window.testPad]:[]});
 });
 const state=()=>page.evaluate(()=>window.puppetDebug.getState());
 const frames=async(n=2)=>{const f=(await state()).frame;await page.waitForFunction(({f,n})=>window.puppetDebug.getState().frame>=f+n,{f,n});};
 const button=async(index,hold=120)=>{await page.evaluate(i=>{window.testPad.buttons[i]={pressed:true,value:1};},index);await frames();await page.waitForTimeout(hold);await page.evaluate(i=>{window.testPad.buttons[i]={pressed:false,value:0};},index);await frames();};
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.puppetDebug?.getState().mode==='menu');
 assert.equal((await state()).meshes,34); // Eight light rays are visual-only.
 const menuPose=(await state()).animations;assert.equal(menuPose.length,3);assert.ok(menuPose.every(a=>a.state==='celebrate'&&a.bones===24));await frames(6);assert.notDeepEqual((await state()).animations[0].pose,menuPose[0].pose,'menu bones animate');await page.screenshot({path:'artifacts/animated-menu.png'});assert.deepEqual(await page.evaluate(()=>window.puppetDiagnostics.getEntries()),[]);
 await button(0);await page.waitForFunction(()=>window.puppetDebug.getState().mode==='playing');
 await page.waitForFunction(()=>window.puppetDebug.getState().enemies>0);
 await page.waitForFunction(()=>window.puppetDebug.getState().animations.some(a=>a.state==='run'));
 const combatDeadline=Date.now()+18000;
 while((await state()).score===0&&Date.now()<combatDeadline){
   const s=await state();const target=s.targets.sort((a,b)=>Math.hypot(a.x-s.position.x,a.z-s.position.z)-Math.hypot(b.x-s.position.x,b.z-s.position.z))[0];
   if(!target)break;
   const desired=Math.atan2(-(target.x-s.position.x),-(target.z-s.position.z));const delta=Math.atan2(Math.sin(desired-s.yaw),Math.cos(desired-s.yaw));
   await page.evaluate(({axis,fire})=>{window.testPad.axes[2]=axis;window.testPad.buttons[7]={pressed:fire,value:fire?1:0};},{axis:Math.abs(delta)<.025?0:-Math.sign(delta)*Math.max(.3,Math.min(1,Math.abs(delta)*2)),fire:Math.abs(delta)<.12});
   await frames(2);
 }
 assert.ok((await state()).score>0,'aimed controller shots damage and eliminate a puppet');
 await page.waitForFunction(()=>window.puppetDebug.getState().animations.some(a=>a.state==='death'));await page.screenshot({path:'artifacts/animated-death.png'});
 await page.evaluate(()=>{window.testPad.axes=[0,0,0,0];window.testPad.buttons[7]={pressed:false,value:0};});
 // Reset for independent ammo / input assertions.
 await button(9);await page.locator('#restart').click();await page.waitForFunction(()=>window.puppetDebug.getState().mode==='playing');
 const initial=await state();await page.evaluate(()=>{window.testPad.axes=[1,0,.5,0];});await page.waitForTimeout(700);await page.evaluate(()=>{window.testPad.axes=[0,0,0,0];});
 const moved=await state();assert.ok(Math.abs(moved.position.x-initial.position.x)>.5,'left stick moves');assert.ok(Math.abs(moved.yaw)>.1,'right stick looks');
 await button(7,350);assert.ok((await state()).ammo[0]<30,'trigger fires');
 await button(2);assert.ok((await state()).reloading>0,'reload starts');await page.waitForFunction(()=>window.puppetDebug.getState().reloading===0);assert.equal((await state()).ammo[0],30,'reload completes');
 await button(3);assert.equal((await state()).weapon,1,'weapon switches');
 await button(9);assert.equal((await state()).mode,'paused');const paused=await state();await page.waitForTimeout(350);assert.deepEqual((await state()).position,paused.position,'paused position is stable');assert.deepEqual((await state()).animations,paused.animations,'pause freezes all bone poses');
 await button(9);assert.equal((await state()).mode,'playing');
 await page.evaluate(()=>{window.testPad=null;});await page.waitForFunction(()=>window.puppetDebug.getState().mode==='paused');
 // Test keyboard and pointer-based touch controls without pointer lock in headless Chrome.
 await page.locator('#pause-settings').click();await page.locator('#touch-toggle').check();await page.locator('#settings-close').click();await page.locator('#resume').click();
 const before=await state();await page.keyboard.down('KeyA');await page.waitForTimeout(400);await page.keyboard.up('KeyA');assert.notEqual((await state()).position.x,before.position.x,'keyboard moves');
 const stick=await page.locator('#move-stick').boundingBox();const beforeTouch=await state();await page.mouse.move(stick.x+stick.width*.8,stick.y+stick.height/2);await page.mouse.down();await page.waitForTimeout(400);await page.mouse.up();assert.notEqual((await state()).position.x,beforeTouch.position.x,'touch stick moves');
 const beforeFire=(await state()).ammo[1];const fire=await page.locator('[data-touch="fire"]').boundingBox();await page.mouse.move(fire.x+fire.width/2,fire.y+fire.height/2);await page.mouse.down();await page.waitForTimeout(300);await page.mouse.up();assert.ok((await state()).ammo[1]<beforeFire,'touch fire');
 await page.screenshot({path:'artifacts/game.png'});
 assert.deepEqual(await page.evaluate(()=>window.puppetDiagnostics.getEntries()),[],'no gameplay errors');
 await page.locator('#pause').click();await page.locator('#main-menu').click();await page.waitForFunction(()=>window.puppetDebug.getState().mode==='menu');
 await page.locator('[data-episode="2"]').click();await page.waitForFunction(()=>window.puppetDebug.getState().mode==='menu'&&window.puppetDebug.getState().episode===2);
 assert.ok((await state()).meshes>0);await page.screenshot({path:'artifacts/episode-2-menu.png'});await page.locator('#play').click();await page.waitForFunction(()=>window.puppetDebug.getState().mode==='playing');await page.waitForFunction(()=>window.puppetDebug.getState().enemies>0);assert.ok((await state()).enemies>0);assert.deepEqual(await page.evaluate(()=>window.puppetDiagnostics.getEntries()),[]);
 await page.screenshot({path:'artifacts/episode-2-game.png'});
 // A real unhandled promise must reach the on-screen panel and pause gameplay.
 await page.evaluate(()=>{void Promise.reject(new Error('Integration rejection: visible diagnostics'));});
 await expect(page.locator('#diagnostics')).toBeVisible();await expect(page.locator('#error-list')).toContainText('Integration rejection');assert.equal((await state()).mode,'paused');
 await page.evaluate(()=>console.error('Integration console error'));await expect(page.locator('#error-list')).toContainText('Integration console error');
 const download=page.waitForEvent('download');await page.locator('#download-errors').click();assert.equal((await download).suggestedFilename(),'puppet-war-diagnostics.json');
 await page.screenshot({path:'artifacts/diagnostics.png'});
 // Failed initial asset fetches must expose status and URL, not a blank canvas.
 const failed=await browser.newPage();await failed.route('**/assets/vr/studio/scene.json',route=>route.fulfill({status:503,body:'test unavailable'}));await failed.goto('http://127.0.0.1:4173');await expect(failed.locator('#diagnostics')).toBeVisible();await expect(failed.locator('#error-list')).toContainText('HTTP 503');await expect(failed.locator('#error-list')).toContainText('scene.json');await failed.close();
 console.log('PASS: both arenas, animated menu/run/death and frozen pause poses, aimed combat hit/kill, standard gamepad movement/look/fire/reload/switch/pause, disconnect, keyboard, touch, rejected promises, diagnostics download, failed asset handling.');
}catch(error){if(page)await page.screenshot({path:'artifacts/integration-failure.png'});throw error;}
finally{await browser.close();}
