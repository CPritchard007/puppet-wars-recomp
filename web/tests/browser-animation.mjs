import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[{id:'Animation test controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}]}));
  await page.goto('http://127.0.0.1:4173');
  await expect(page.locator('#play')).toBeEnabled();await page.locator('#play').click();
  await page.waitForFunction(()=>window.puppetDebug.getState().animations.some(a=>a.state==='run'));
  await page.screenshot({path:'artifacts/animated-run.png'});
  await page.waitForFunction(()=>window.puppetDebug.getState().animations.some(a=>a.state==='attack'),null,{timeout:45000});
  const before=await page.evaluate(()=>window.puppetDebug.getState());
  await page.waitForFunction(frame=>window.puppetDebug.getState().frame>frame+5,before.frame);
  const after=await page.evaluate(()=>window.puppetDebug.getState());
  assert.ok(after.health<100,'attack still delivers gameplay damage');
  assert.notDeepEqual(after.animations,before.animations,'attack bones advance');
  await page.screenshot({path:'artifacts/animated-attack.png'});
  assert.deepEqual(await page.evaluate(()=>window.puppetDiagnostics.getEntries()),[]);
  console.log('PASS: recovered run -> attack transition animates in Chrome, attack damages player, no diagnostics errors.');
}finally{await browser.close();}
