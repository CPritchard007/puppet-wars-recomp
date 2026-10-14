import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[{id:'Generic AI test pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}]}));
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.puppetDebug?.getState().mode==='menu');await page.locator('#play').click();
 await page.waitForFunction(()=>window.puppetDebug.getState().enemies===6);
 const state=()=>page.evaluate(()=>window.puppetDebug.getState());
 assert.equal(new Set((await state()).targets.map(e=>e.type)).size,6);
 await page.waitForFunction(()=>window.puppetDebug.getState().projectiles.length>0);
 const first=await state();assert.ok(first.targets.some(e=>['throw','coverWait','reposition'].includes(e.state)));
 await page.screenshot({path:'artifacts/enemy-types.png'});
 await page.locator('#pause').click();const before=await state();await page.waitForTimeout(350);assert.deepEqual((await state()).projectiles,before.projectiles);assert.deepEqual((await state()).targets,before.targets);
 assert.deepEqual(await page.evaluate(()=>window.puppetDiagnostics.getEntries()),[]);
 console.log('PASS: six distinct first-wave types, ranged projectiles, frozen AI/projectiles on pause, no diagnostics.');
}finally{await browser.close();}
