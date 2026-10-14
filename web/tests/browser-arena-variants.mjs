import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{Object.defineProperty(navigator,'getGamepads',{value:()=>[{id:'Variant test pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}]});});await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.puppetDebug?.getState().mode==='menu');
 for(const id of [1,2,3,4]){
  await page.locator(`[data-episode="${id}"]`).click();await page.waitForFunction(id=>puppetDebug.getState().mode==='menu'&&puppetDebug.getState().episode===id,id);
  for(const period of ['day','night']){
   await page.locator('#time-of-day').selectOption(period);await page.waitForFunction(period=>puppetDebug.getState().mode==='menu'&&puppetDebug.getState().timeOfDay===period,period);
   assert.deepEqual(await page.evaluate(()=>puppetDiagnostics.getEntries()),[]);await page.screenshot({path:`artifacts/arena-${id}-${period}.png`});await page.locator('#encounter-mode').selectOption('vr');await page.locator('#play').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='playing'&&puppetDebug.getState().enemies>0);assert.deepEqual(await page.evaluate(()=>puppetDiagnostics.getEntries()),[]);await page.locator('#pause').click();await page.locator('#main-menu').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='menu');console.log('PASS render and spawn',id,period);
  }
 }assert.deepEqual(errors,[]);
}finally{await browser.close();}
