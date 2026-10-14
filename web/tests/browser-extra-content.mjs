import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.testPad={id:'Generic test pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[testPad]});});
 const state=()=>page.evaluate(()=>puppetDebug.getState());const fire=async held=>page.evaluate(held=>testPad.buttons[7]={pressed:held,value:held?1:0},held);
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.puppetDebug?.getState().mode==='menu');
 for(const [arena,period] of [[5,'day'],[6,'day'],[6,'night']]){
  await page.locator(`[data-episode="${arena}"]`).click();await page.waitForFunction(id=>puppetDebug.getState().mode==='menu'&&puppetDebug.getState().episode===id,arena);
  await page.locator('#time-of-day').selectOption(period);await page.waitForFunction(p=>puppetDebug.getState().mode==='menu'&&puppetDebug.getState().timeOfDay===p,period);
  await page.locator('#encounter-mode').selectOption('vr');await page.locator('#starting-weapon').selectOption('9');await page.locator('#play').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='playing'&&puppetDebug.getState().enemies>0);
  await page.screenshot({path:`artifacts/extra-arena-${arena}-${period}.png`});assert.deepEqual(await page.evaluate(()=>puppetDiagnostics.getEntries()),[]);
  await page.locator('#pause').click();await page.locator('#main-menu').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='menu');console.log('PASS arena',arena,period);
 }
 for(let i=9;i<14;i++){
  await page.locator('#starting-weapon').selectOption(String(i));await page.locator('#play').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='playing');await fire(true);await page.waitForFunction(()=>puppetDebug.getState().weaponAnimation.state==='fire');await page.waitForTimeout(100);await page.screenshot({path:`artifacts/extra-weapon-${i}.png`});await fire(false);
  if(i<12){assert.ok((await state()).ammo[i]<30);await page.evaluate(()=>testPad.buttons[2]={pressed:true,value:1});await page.waitForTimeout(80);await page.evaluate(()=>testPad.buttons[2]={pressed:false,value:0});await page.waitForFunction(()=>puppetDebug.getState().weaponAnimation.state==='reload');await page.screenshot({path:`artifacts/extra-weapon-${i}-reload.png`});await page.waitForFunction(()=>puppetDebug.getState().reloading===0);assert.equal((await state()).ammo[i],30);}
  assert.deepEqual(await page.evaluate(()=>puppetDiagnostics.getEntries()),[]);await page.locator('#pause').click();await page.locator('#main-menu').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='menu');console.log('PASS weapon',i);
 }assert.deepEqual(errors,[]);
}finally{await browser.close();}
