import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:844,height:330},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Reproduce stale innerHeight after browser chrome disappears.
 await page.addInitScript(()=>{Object.defineProperty(window,'innerHeight',{get:()=>330});Object.defineProperty(navigator,'getGamepads',{value:()=>[]});});
 await page.goto('http://127.0.0.1:4173');
 await page.waitForFunction(()=>window.puppetDebug?.getState().mode==='menu');
 for(const size of [{width:844,height:390},{width:390,height:844},{width:844,height:430}]){
  await page.setViewportSize(size);
  await page.waitForFunction(({width,height})=>{
   const game=document.querySelector('#game'),weapon=document.querySelector('#weapon'),r=game.getBoundingClientRect();
   return r.x===0&&r.y===0&&r.width===width&&r.height===height&&game.width===width*2&&game.height===height*2&&weapon.width===width&&weapon.height===height;
  },size);
 }
 assert.equal(await page.locator('#game').evaluate(e=>e.style.height),'');
 const manifest=await (await page.request.get('http://127.0.0.1:4173/manifest.webmanifest')).json();
 assert.equal(manifest.display,'fullscreen');assert.equal(manifest.start_url,'./');
 assert.deepEqual(errors,[]);
 console.log('PASS viewport expansion and rotation with stale innerHeight');
}finally{await browser.close();}
