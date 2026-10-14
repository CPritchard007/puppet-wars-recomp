import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.puppetDebug?.getState().mode==='menu');
 assert.equal(await page.locator('.map').count(),6);
 for(const id of ['time-of-day','encounter-mode','loadout-mode','starting-weapon','auto-fire','settings-open','play'])assert.ok(await page.locator('#'+id).isVisible());
 await page.locator('#encounter-mode').selectOption('vr');await page.locator('#starting-weapon').selectOption('2');
 await page.screenshot({path:'artifacts/original-style-menu.png'});
 await page.locator('#settings-open').click();assert.ok(await page.locator('#settings').isVisible());await page.locator('#settings-close').click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/original-style-menu-mobile.png'});
 assert.ok(await page.evaluate(()=>document.querySelector('#menu').scrollWidth<=innerWidth));
 await page.locator('#play').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='playing');assert.equal(await page.evaluate(()=>puppetDebug.getState().weapon),2);
 await page.locator('#pause').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='paused');
 await page.screenshot({path:'artifacts/original-style-pause-mobile.png'});
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'artifacts/original-style-pause.png'});
 await page.locator('#pause-loadout').click();assert.notEqual(await page.evaluate(()=>puppetDebug.getState().weapon),2);
 await page.locator('#pause-settings').click();assert.ok(await page.locator('#settings').isVisible());await page.locator('#settings-close').click();
 await page.locator('#resume').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='playing');
 await page.locator('#pause').click();await page.locator('#main-menu').click();await page.waitForFunction(()=>puppetDebug.getState().mode==='menu');
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>puppetDiagnostics.getEntries()),[]);
 console.log('PASS menu selections, settings, mobile layout and launch');
}finally{await browser.close();}
