import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');
 await page.waitForFunction(()=>window.puppetDebug?.getState().mode==='menu');
 for(const id of [1,2,3,4]){if(id!==1){await page.locator(`[data-episode="${id}"]`).click();await page.waitForFunction(id=>window.puppetDebug.getState().mode==='menu'&&window.puppetDebug.getState().episode===id,id);}
  console.log(await page.evaluate(()=>{const s=puppetDebug.getState();return {arena:s.arena,position:s.position,bounds:s.bounds,meshes:s.meshes,teleports:s.teleports.length};}));await page.screenshot({path:`artifacts/vr-arena-${id}.png`});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>puppetDiagnostics.getEntries()),[]);console.log('PASS four VR worlds load without diagnostics');
}finally{await browser.close();}
