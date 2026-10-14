import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.testPad={id:'Generic test controller',connected:true,index:0,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[testPad]});});
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.puppetDebug?.getState().mode==='menu');await page.locator('[data-episode="3"]').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='menu'&&puppetDebug.getState().arena==='town');
 const state=()=>page.evaluate(()=>puppetDebug.getState());
 for(let weapon=3;weapon<9;weapon++){
  await page.locator('#starting-weapon').selectOption(String(weapon));await page.locator('#encounter-mode').selectOption('vr');await page.locator('#play').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='playing');assert.equal((await state()).weapon,weapon);
  await page.evaluate(()=>testPad.buttons[7]={pressed:true,value:1});await page.waitForFunction(()=>['fire','fireAlt'].includes(puppetDebug.getState().weaponAnimation?.state));
  if([3,4].includes(weapon)){const kind=weapon===3?'tracer':'flame';await page.waitForFunction(kind=>puppetDebug.getState().weaponEffects?.[kind]>0,kind);await page.waitForTimeout(250);}
  if(weapon===6)assert.deepEqual((await state()).weaponEffects,{},'blower must not emit smoke');
  await page.screenshot({path:`artifacts/vr-weapon-${weapon}.png`});await page.evaluate(()=>testPad.buttons[7]={pressed:false,value:0});
  if(weapon!==5)assert.ok((await state()).ammo[weapon]<(weapon===3?30:weapon===4?100:weapon===6?60:1));
  await page.waitForTimeout(1000);assert.deepEqual((await state()).weaponEffects,{},'shot effects expire after release');
  if(weapon>=7)assert.ok((await state()).perkTimers[weapon]>0);
  assert.deepEqual(await page.evaluate(()=>puppetDiagnostics.getEntries()),[]);
  await page.locator('#pause').click();await page.locator('#main-menu').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='menu');console.log('PASS weapon',weapon);
 }
 await page.locator('#loadout-mode').selectOption('vr');await page.locator('#play').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='playing');await page.waitForFunction(()=>puppetDebug.getState().enemies>0);assert.ok([3,4].includes((await state()).weapon));assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>puppetDiagnostics.getEntries()),[]);console.log('PASS VR arsenal, animations, special cooldowns, random loadout and source spawning');
}finally{await browser.close();}
