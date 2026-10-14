import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:1500,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/tests/roster-preview.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.screenshot({path:'artifacts/character-roster.png'});console.log(await page.evaluate(()=>{const a=rosterPreview.actors.find(a=>a.modelType==='kart');a.mesh.computeBoundingBox();return {kartBounds:a.mesh.boundingBox,scale:a.display.scale};}));
await page.evaluate(async()=>{
 const {EnemyEffects}=await import('/src/enemy-effects.js');const {actors,roster,scene,camera,renderer}=rosterPreview;
 for(const a of actors)a.visible=a.modelType==='fish';const fish=actors.find(a=>a.modelType==='fish');fish.position.set(0,0,0);fish.play('throw',0,true);fish.update(.65);fish.setEnemyId(1);
 const effects=new EnemyEffects(scene,roster.projectiles);effects.update({time:.65,floorY:0,enemies:[{id:1,type:'fish',state:'throw'}],projectiles:[{id:2,kind:'fish',x:2,y:2,z:0,age:.1}],effects:[]},new Map([[1,fish]]));
 camera.left=-4;camera.right=4;camera.top=5;camera.bottom=-.4;camera.position.set(0,0,50);camera.lookAt(0,0,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
 if([...effects.meshes.values()].some(m=>!m.isSprite||!m.material.transparent))throw new Error('Fish must use original transparent sprite');
});await page.screenshot({path:'artifacts/fish-throw.png'});assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.puppetDiagnostics.getEntries()),[]);console.log('PASS: 17 original character models render without errors.');}finally{await browser.close();}
