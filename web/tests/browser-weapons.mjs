import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.addInitScript(()=>{window.testPad={id:'Generic pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad]});});
 const button=async i=>{await page.evaluate(i=>window.testPad.buttons[i]={pressed:true,value:1},i);await page.waitForTimeout(90);await page.evaluate(i=>window.testPad.buttons[i]={pressed:false,value:0},i);};
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.puppetDebug?.getState().mode==='menu');await page.locator('#play').click();
 for(let weapon=0;weapon<3;weapon++){
  await page.waitForTimeout(300);await button(7);await page.waitForFunction(()=>window.puppetDebug.getState().weaponAnimation.state==='fire');
  await page.screenshot({path:`artifacts/weapon-${weapon}-attack.png`});
  if(weapon<2){await button(2);await page.waitForFunction(()=>window.puppetDebug.getState().weaponAnimation.state==='reload');await page.waitForTimeout(500);await page.screenshot({path:`artifacts/weapon-${weapon}-reload.png`});await page.waitForFunction(()=>window.puppetDebug.getState().reloading===0);}
  else {await page.waitForFunction(()=>window.puppetDebug.getState().weaponAnimation.texture.includes('AfterFire'));await page.screenshot({path:'artifacts/mop-recovery.png'});}
  await button(3);
 }
 assert.deepEqual(await page.evaluate(()=>window.puppetDiagnostics.getEntries()),[]);console.log('PASS: controller attacks and reloads both guns; mop swing and recovery render without errors.');
}finally{await browser.close();}
