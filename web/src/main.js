import * as THREE from 'three';
import { Input, PROFILES } from './input.js';
import { characterAnimation,characterFacing } from './character-roster.js';
import { labelEnemy,EnemyEffects } from './enemy-effects.js';
import { weaponFrame } from './weapon-animation.js';
import { Simulation,WEAPONS,moveBody } from './simulation.js';
import { ARENAS } from './arenas.js';
import {PickupSprite} from './pickups.js';
import {weaponLayout,muzzlePixel} from './weapon-layout.js';
import { WeaponEffects } from './weapon-effects.js';
import { VRExperience } from './vr.js';
import { loadWorld, loadImage } from './world.js';
import { reportError, setContext, readSaved, save, fetchJSON } from './diagnostics.js';
const $=s=>document.querySelector(s),canvas=$('#game'),weaponCanvas=$('#weapon'),ctx=weaponCanvas.getContext('2d');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(error){throw new Error(`WebGL could not start. Enable hardware acceleration or try another browser. ${error.message}`);}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.05,400);camera.rotation.order='YXZ';
const stored=readSaved('puppet-web-settings-v1',{});
const input=new Input(canvas,stored);input.onError=error=>reportError(error,{operation:'read controller',hint:'Check browser controller permissions. Keyboard and touch remain available.'});let volume=Number.isFinite(stored.volume)?stored.volume:.4;
let showTouch=stored.showTouch??matchMedia('(pointer:coarse)').matches;
let episode=1,world=null,sim=null,mode='loading',previousMode='menu',loadToken=0,last=performance.now(),shotFlash=0,hitMarker=0,hasPlayed=false;
let enemyEffects=null,weaponEffects=null;
let weaponClips=[],weaponVisual=null;
let images={},soundBuffers={},audio=null,starting=false;const enemyActors=new Map(),pickupMeshes=new Map();let decorative=[];
const ray=new THREE.Raycaster(),targetDirection=new THREE.Vector3();
const savedBest=readSaved('puppet-web-best-v1',0);let best=Number.isFinite(savedBest)?savedBest:0;
const vr=new VRExperience(renderer,camera,weaponCanvas,{
 onEnd(){pause('VR session ended. Resume to continue on screen.');$('#enter-vr').textContent='Enter VR';resize();},
 onError:error=>reportError(error,{operation:'VR controls'}),
 onAction(action){if(action==='exit'){vr.end().catch(error=>reportError(error,{operation:'exit VR'}));return;}if(action==='pause'){pause();return;}if(action==='resume'){if(mode==='paused'){setMode('playing');}else if(mode==='over')startRun();return;}if(mode!=='playing')return;if(action==='switch')sim.switchWeapon();if(action==='reload')sim.reload();if(action==='perk'){const index=sim.loadout.find(i=>WEAPONS[i].perk&&sim.perkTimers[i]===0);if(index!==undefined&&sim.selectWeapon(index)){sim.cooldown=0;shoot();}}}
});
vr.supported().then(supported=>{$('#enter-vr').disabled=!supported;$('#enter-vr').textContent=supported?'Enter VR':'VR requires a WebXR headset browser';}).catch(error=>{$('#enter-vr').textContent='VR unavailable in this browser';reportError(error,{operation:'check VR support'});});
$('#enter-vr').onclick=async()=>{try{if(mode==='loading')return;await vr.start();await startRun();$('#enter-vr').textContent='VR connected';}catch(error){reportError(error,{operation:'enter VR'});}};
function resize(){if(renderer.xr.isPresenting)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();weaponCanvas.width=innerWidth;weaponCanvas.height=innerHeight;}
window.addEventListener('resize',resize);resize();
function setMode(next){mode=next;setContext({phase:mode,episode});input.active=mode==='playing';$('#menu').hidden=!['menu','loading'].includes(mode);$('#pause-menu').hidden=!['paused','over'].includes(mode);$('#hud').hidden=!['playing','paused'].includes(mode);$('#crosshair').hidden=mode!=='playing';$('#pause').hidden=mode!=='playing';$('#touch-controls').hidden=mode!=='playing'||!showTouch;
  if(mode!=='playing'){input.clear();if(document.pointerLockElement)document.exitPointerLock();}
}
function pause(reason='Your run is waiting.'){if(mode!=='playing')return;$('#pause-title').textContent='Paused.';$('#pause-detail').textContent=reason;$('#resume').hidden=false;setMode('paused');$('#resume').focus();}
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&mode==='playing')pause('Mouse released. Resume when you’re ready.');});
window.addEventListener('blur',()=>{if(!renderer.xr.isPresenting)pause('Paused because the window lost focus.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!renderer.xr.isPresenting)pause('Paused while the tab is hidden.');});
document.addEventListener('gameerror',()=>pause('An error occurred. Open Diagnostics for the full report.'));
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();reportError(new Error('WebGL graphics context lost. Reload the app to restore rendering.'),{kind:'graphics'});});
async function lockMouse(){if(showTouch||input.pad||renderer.xr.isPresenting)return;try{await canvas.requestPointerLock();}catch(error){reportError(error,{operation:'capture mouse',hint:'Click Resume to retry pointer lock.'});}}
async function unlockAudio(){try{audio??=new(window.AudioContext||window.webkitAudioContext)();await audio.resume();}catch(error){reportError(error,{operation:'start audio'});}}
async function loadSounds(){soundBuffers={};if(!audio)return;await Promise.all(['shot','shotgun','reload','hurt','hit','pickup'].map(async name=>{
 try{const url=`assets/episode-${Math.min(episode,2)}/${name}.wav`,res=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!res.ok)throw new Error(`HTTP ${res.status} loading ${url}`);soundBuffers[name]=await audio.decodeAudioData(await res.arrayBuffer());}
 catch(error){reportError(error,{operation:`load ${name} audio`});}
}));
 const extras={...await fetchJSON('assets/vr/weapons/audio.json'),mopHit:'assets/weapons/mop-hit.wav',mopMiss:'assets/weapons/mop-miss.wav'};await Promise.all(Object.entries(extras).map(async([name,url])=>{const res=await fetch(url);if(!res.ok)throw new Error(`HTTP ${res.status} loading ${url}`);soundBuffers[name]=await audio.decodeAudioData(await res.arrayBuffer());}));}
function sound(name){if(!audio||!soundBuffers[name]||volume<=0)return;const s=audio.createBufferSource(),gain=audio.createGain();s.buffer=soundBuffers[name];gain.gain.value=volume*.6;s.connect(gain);gain.connect(audio.destination);s.start();s.onended=()=>{s.disconnect();gain.disconnect();};}
let loopSound=null,musicSound=null;
function updateMusic(){
 const name=!hasPlayed?null:mode==='playing'?(world?.timeOfDay==='night'?'MusicNight':'Game1'):mode==='over'?'Game2':mode==='menu'?'MainMenu1':null;
 if(musicSound?.name!==name){if(musicSound){musicSound.source.stop();musicSound.source.disconnect();musicSound.gain.disconnect();musicSound=null;}if(name&&audio&&soundBuffers[name]){const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=soundBuffers[name];source.loop=name!=='Game2';source.connect(gain);gain.connect(audio.destination);source.start();musicSound={name,source,gain};}}
 if(musicSound)musicSound.gain.gain.value=volume*.25;
}
function updateLoopSound(){
 const name=mode==='playing'&&sim?.weapon.continuous&&sim.trigger&&!sim.reloading&&sim.ammo[sim.weaponIndex]>=1&&sim.triggerTime>=sim.weapon.windup?sim.weapon.id:null;
 if(loopSound?.name!==name){if(loopSound){loopSound.source.stop();loopSound.source.disconnect();loopSound.gain.disconnect();loopSound=null;}if(name&&audio&&soundBuffers[name]){const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=soundBuffers[name];source.loop=true;source.connect(gain);gain.connect(audio.destination);source.start();loopSound={name,source,gain};}}
 if(loopSound)loopSound.gain.gain.value=volume*.6;
}
function clearActors(){weaponEffects?.dispose();weaponEffects=null;enemyEffects?.dispose();enemyEffects=null;for(const m of enemyActors.values()){m.dispose();}enemyActors.clear();for(const m of pickupMeshes.values()){m.dispose();}pickupMeshes.clear();for(const m of decorative){m.dispose();}decorative=[];}
async function selectEpisode(ep){
  const token=++loadToken;episode=ep;setMode('loading');$('#play').disabled=true;$('#play').textContent='Loading original assets…';
  document.querySelectorAll('.map').forEach(b=>b.classList.toggle('selected',Number(b.dataset.episode)===ep));
  try{
    const next=await loadWorld(ep,text=>{if(token===loadToken)$('#loading-status').textContent=text;},$('#time-of-day').value);
    if(token!==loadToken){next.dispose();return;}
    const legacyClips=await fetchJSON('assets/weapons/animations.json'),vrClips=await fetchJSON('assets/vr/weapons/animations.json');
    const clips=[...legacyClips.map(w=>Object.fromEntries(Object.entries(w).map(([k,frames])=>[k,Array.isArray(frames)?frames.map(f=>({...f,texture:'assets/weapons/'+f.texture})):frames]))),...WEAPONS.slice(3).map(w=>vrClips[w.id])];
    const names=[...new Set(clips.flatMap(w=>Object.values(w).filter(Array.isArray).flat().map(f=>f.texture)))];
    const loadedImages=await Promise.all(names.map(n=>loadImage(n)));
    if(token!==loadToken){next.dispose();return;}
    clearActors();vr.rig.removeFromParent();world?.dispose();world=next;vr.attach(world);weaponClips=clips;images=Object.fromEntries(names.map((n,i)=>[n,loadedImages[i]]));
    sim=new Simulation(runOptions());sim.floorY=world.floorY;enemyEffects=new EnemyEffects(world.scene,world.roster.projectiles);weaponEffects=new WeaponEffects(world.scene,world.flameMap);camera.position.set(world.spawn.x,world.eyeHeight,world.spawn.z);camera.rotation.set(0,0,0);
    for(let i=0;i<3;i++){const m=world.makePuppet(['grunt','fish','chicken'][i]);m.position.set(world.spawn.x+3+i*3,world.floorY,world.spawn.z-10-i*4);m.rotation.y=0;m.play('celebrate',0);m.update(i*.27);decorative.push(m);}
    setMode('menu');$('#play').disabled=false;$('#play').textContent='Enter the arena →';$('#loading-status').textContent=`Ready · ${ARENAS.find(a=>a.id===ep).name} · ${world.timeOfDay==='day'?'Day':'Night'} · Best ${best.toLocaleString()}`;
  }catch(error){if(token!==loadToken)return;reportError(error,{operation:'load arena',episode:ep});$('#play').textContent='Loading failed';$('#loading-status').textContent='See Diagnostics for details. Select an arena to retry.';}
}
function runOptions(){const options={...world,encounterMode:$('#encounter-mode').value,startingWeapon:Number($('#starting-weapon').value)||0};if($('#loadout-mode').value==='vr'){options.loadout=[Math.random()<.6?3:4,Math.random()<.5?5:6,Math.random()<.5?7:8];options.startingWeapon=options.loadout[0];}return options;}
async function startRun(){
  if(!world||mode==='loading'||starting)return;starting=true;$('#play').disabled=true;$('#restart').disabled=true;$('#loading-status').textContent='Preparing sound and starting the run…';
  try{await unlockAudio();await loadSounds();clearActors();world.resetScenery();sim=new Simulation(runOptions());sim.floorY=world.floorY;enemyEffects=new EnemyEffects(world.scene,world.roster.projectiles);weaponEffects=new WeaponEffects(world.scene,world.flameMap);hasPlayed=true;setMode('playing');if(!$('#diagnostics').hidden)pause('An error was reported while starting. Review Diagnostics, then resume.');else await lockMouse();}
  catch(error){reportError(error,{operation:'start run'});}
  finally{starting=false;$('#play').disabled=false;$('#restart').disabled=false;}
}
$('#time-of-day').onchange=()=>selectEpisode(episode);
$('#play').onclick=startRun;$('#restart').onclick=startRun;
$('#resume').onclick=async()=>{setMode('playing');await unlockAudio();await lockMouse();};
$('#pause').onclick=()=>pause();$('#main-menu').onclick=()=>selectEpisode(episode);
$('#reload-app').onclick=()=>location.reload();
document.querySelector('.map-options').innerHTML=ARENAS.map(a=>`<button class="map" data-episode="${a.id}"><small>VR ARENA ${String(a.id).padStart(2,'0')}</small><strong>${a.name}</strong><span>${a.description}</span></button>`).join('');
WEAPONS.forEach((w,i)=>$('#starting-weapon').add(new Option(w.name,i)));
$('#pause-loadout').onclick=()=>{sim.switchWeapon();$('#pause-detail').textContent=`Selected ${sim.weapon.name}. Press Change weapon again to cycle.`;updateHUD();};
document.querySelectorAll('[data-episode]').forEach(b=>b.onclick=()=>selectEpisode(Number(b.dataset.episode)));
function openSettings(){previousMode=mode;if(mode==='playing')pause();$('#settings').hidden=false;$('#profile').focus();}
$('#settings-open').onclick=openSettings;$('#pause-settings').onclick=openSettings;
function closeSettings(){storeSettings();$('#settings').hidden=true;if(previousMode==='playing')setMode('paused');if(mode==='menu')$('#play').focus();else $('#resume').focus();}
$('#settings-close').onclick=closeSettings;
function storeSettings(){save('puppet-web-settings-v1',{bindings:input.bindings,deadzone:input.deadzone,sensitivity:input.sensitivity,invertY:input.invertY,volume,showTouch,profile:$('#profile').value});}
const labels={teleport:'Teleport',fire:'Fire',aim:'Aim',reload:'Reload',switch:'Switch weapon',jump:'Jump',pause:'Pause',moveX:'Move X axis',moveY:'Move Y axis',lookX:'Look X axis',lookY:'Look Y axis'};
for(const [key,label]of Object.entries(labels)){const row=document.createElement('label');row.textContent=label;const select=document.createElement('select');select.dataset.binding=key;const axis=key.endsWith('X')||key.endsWith('Y');for(let i=0;i<(axis?12:32);i++){const option=new Option(`${axis?'Axis':'Button'} ${i}`,i);select.add(option);}select.value=input.bindings[key];select.onchange=()=>{input.bindings[key]=Number(select.value);$('#profile').value='custom';storeSettings();};row.append(select);$('#bindings').append(row);}
$('#profile').value=stored.profile||'standard';$('#profile').onchange=e=>{if(PROFILES[e.target.value]){input.bindings={...PROFILES[e.target.value]};document.querySelectorAll('[data-binding]').forEach(s=>s.value=input.bindings[s.dataset.binding]);}storeSettings();};
for(const [id,key]of [['sensitivity','sensitivity'],['deadzone','deadzone']]){const el=$('#'+id);el.value=input[key];el.oninput=()=>{input[key]=Number(el.value);storeSettings();};}
$('#volume').value=volume;$('#volume').oninput=e=>{volume=Number(e.target.value);storeSettings();};$('#invert').checked=input.invertY;$('#invert').onchange=e=>{input.invertY=e.target.checked;storeSettings();};$('#touch-toggle').checked=showTouch;$('#touch-toggle').onchange=e=>{showTouch=e.target.checked;storeSettings();};
function aimRay(x=0,y=0){if(vr.active){vr.aim(ray);if(x||y)ray.ray.direction.add(new THREE.Vector3(x,y,0)).normalize();}else ray.setFromCamera(new THREE.Vector2(x,y),camera);}
function weaponMuzzle(){
 const p=muzzlePixel(sim.weapon.id,innerWidth,innerHeight);
 if(vr.active){vr.weapon.updateWorldMatrix(true,false);return vr.weapon.localToWorld(new THREE.Vector3((p.x/innerWidth-.5)*1.1,(.5-p.y/innerHeight)*.7,0));}
 const direction=new THREE.Vector3(p.x/innerWidth*2-1,1-p.y/innerHeight*2,.5).unproject(camera).sub(camera.position).normalize();
 const forward=camera.getWorldDirection(new THREE.Vector3());return camera.position.clone().addScaledVector(direction,3/direction.dot(forward));
}
function shoot(){
  if(!sim.shot())return;shotFlash=.14;input.rumble();if(!sim.weapon.continuous&&sim.weapon.id!=='mop')sound(sim.weapon.id|| (sim.weaponIndex===1?'shotgun':'shot'));
  if(sim.weapon.perk)return;
  if(sim.weapon.id==='mop'){aimRay();sim.pendingAttacks.at(-1).direction=ray.ray.direction.clone();return;}
  const meshes=[...enemyActors.values()].filter(actor=>actor.state!=='death'&&actor.visible).flatMap(actor=>actor.meshes.filter(m=>m.visible));
  aimRay();weaponEffects?.emit(sim.weapon,ray.ray,world.staticMeshes,meshes,weaponMuzzle());
  if(sim.weapon.cone){
    aimRay();const origin=ray.ray.origin.clone(),forward=ray.ray.direction.clone();
    for(const e of sim.enemies){if(e.hidden)continue;const delta=new THREE.Vector3(e.x-origin.x,world.floorY+1.5-origin.y,e.z-origin.z),distance=delta.length();if(distance>sim.weapon.range||delta.normalize().dot(forward)<Math.cos(sim.weapon.cone))continue;ray.set(origin,delta);ray.far=distance;const wall=ray.intersectObjects(world.staticMeshes,false)[0];if(wall&&wall.distance<distance-.1)continue;if(sim.damageEnemy(e,sim.weapon.damage)){e.burning=sim.weapon.burn||0;hitMarker=.18;}}return;
  }
  for(let pellet=0;pellet<sim.weapon.pellets;pellet++){
    const spread=sim.weapon.pellets===1?0:.065;aimRay((Math.random()-.5)*spread,(Math.random()-.5)*spread);ray.far=sim.weapon.range;
    const hit=ray.intersectObjects(meshes,false)[0];
    const wall=ray.intersectObjects(world.staticMeshes,false)[0];if(wall&&(!hit||wall.distance<hit.distance-.1)){world.damageScenery(wall,sim.weapon.damage);continue;}if(!hit)continue;
    const enemy=sim.enemies.find(e=>e.id===hit.object.userData.enemyId);if(enemy&&sim.damageEnemy(enemy,sim.weapon.damage)){if(sim.weapon.push&&enemy.type!=='trash'){const direction=ray.ray.direction;moveBody(enemy,direction.x*sim.weapon.push*.05,direction.z*sim.weapon.push*.05,sim.bounds,sim.obstacles,.7);}hitMarker=.18;sound('hit');}
  }
}
function updateActors(dt){
  const characters=[...sim.enemies.filter(e=>e.health>0),...sim.corpses];
  const present=new Set(characters.map(e=>e.id));
  for(const[id,actor]of enemyActors)if(!present.has(id)){actor.dispose();enemyActors.delete(id);}
  for(const e of characters){
    let actor=enemyActors.get(e.id);
    const model=e.type==='vampire'&&e.form==='bat'?'bat':e.type;
    if(actor&&actor.modelType!==model){actor.dispose();enemyActors.delete(e.id);actor=null;}
    if(!actor){actor=world.makePuppet(model);actor.hitVersion=e.hitVersion||0;actor.setEnemyId(e.id);labelEnemy(actor,e.type);enemyActors.set(e.id,actor);}
    actor.visible=!e.hidden;actor.scale.setScalar(e.magicScale||1);
    actor.position.set(e.x,world.floorY+(e.y||0),e.z);
    actor.rotation.y=characterFacing(e,sim.player,actor.rotation.y);
    actor.update(dt,e.animation==='death'?'death':characterAnimation(e,actor),e.hitVersion||0,e.actionVersion||0);
    actor.setTint(e.shield?0x75baff:e.health>0&&e.flash>0?0xffbbaa:0xffffff);
  }
  const picks=new Set(sim.pickups);for(const[p,m]of pickupMeshes)if(!picks.has(p)){m.dispose();pickupMeshes.delete(p);}
  for(const p of sim.pickups){let m=pickupMeshes.get(p);if(!m){m=new PickupSprite(p.kind,world.pickups[p.kind]);world.scene.add(m);pickupMeshes.set(p,m);}m.position.set(p.x,world.floorY+1+Math.sin(sim.time*3)*.2,p.z);m.animate(sim.time);}
}
function drawWeapon(){ctx.clearRect(0,0,innerWidth,innerHeight);if(!hasPlayed||!['playing','paused','over'].includes(mode)||!sim)return;
  weaponVisual=weaponFrame(weaponClips[sim.weaponIndex],sim);
  const image=images[weaponVisual.texture];if(!image)throw new Error(`Missing weapon atlas: ${weaponVisual.texture}`);
  const [u,v,uw,vh]=weaponVisual.uv,[left,top,right,bottom]=weaponVisual.bounds;
  // PackedSprite trims each frame. Its original normalized bounds preserve the
  // hands' placement across atlases; Unity UVs have a bottom-left origin.
  const {halfH,halfW,baseY}=weaponLayout(innerWidth,innerHeight);
  ctx.drawImage(image,Math.round(u*image.width),Math.round((1-v-vh)*image.height),Math.round(uw*image.width),Math.round(vh*image.height),
    innerWidth/2+left*halfW,baseY-top*halfH,(right-left)*halfW,(top-bottom)*halfH);
}
function updateHUD(){const i=sim.weaponIndex;$('#health').textContent=Math.ceil(sim.player.health);$('#health-fill').style.width=sim.player.health+'%';$('#ammo').innerHTML=sim.weapon.melee?'∞':sim.weapon.perk?(sim.perkTimers[i]>0?`${Math.ceil(sim.perkTimers[i])}s`:'READY'):`${Math.floor(sim.ammo[i])} <small>/ ${sim.reserve[i]}</small>`;$('#weapon-name').textContent=sim.weapon.name;$('#wave').textContent=`WAVE ${String(Math.max(1,sim.wave)).padStart(2,'0')}`;$('#remaining').textContent=sim.enemies.length?`${sim.enemies.length} PUPPETS LEFT`:`NEXT WAVE IN ${Math.ceil(sim.nextWave)}`;$('#score').textContent=`${sim.score.toLocaleString()} POINTS`;$('#reload-status').textContent=sim.weapon.melee?(input.pad?`MELEE · SWITCH · B${input.bindings.switch}`:'MELEE · Q · SWITCH'):sim.reloading?`RELOADING ${sim.reloading.toFixed(1)}s`:input.pad?`RELOAD · B${input.bindings.reload}   SWITCH · B${input.bindings.switch}`:'R · RELOAD   Q · SWITCH';$('#hit-screen').style.opacity=sim.hurt;$('#crosshair').classList.toggle('hit',hitMarker>0);}
$('#show-errors').addEventListener('click',()=>{if(!$('#diagnostics').hidden)pause('Diagnostics are open.');});
let lastMenuNav=0,frameCount=0;
function menuGamepad(state,now){
 if(!input.pad)return;
 const container=!$('#settings').hidden?$('#settings'):!$('#diagnostics').hidden?$('#diagnostics'):['paused','over'].includes(mode)?$('#pause-menu'):$('#menu');
 const elements=[...container.querySelectorAll('button,select,input')].filter(el=>!el.disabled&&el.offsetParent!==null);
 if(!elements.length)return;
 const focused=document.activeElement;
 if(elements.includes(focused)&&(state.pressed.left||state.pressed.right)&&['SELECT','INPUT'].includes(focused.tagName)){
   const delta=state.pressed.right?1:-1;
   if(focused.tagName==='SELECT'){focused.selectedIndex=(focused.selectedIndex+delta+focused.options.length)%focused.options.length;focused.dispatchEvent(new Event('change'));}
   else if(focused.type==='range'){focused.value=Number(focused.value)+delta*Number(focused.step);focused.dispatchEvent(new Event('input'));}
   return;
 }
 const direction=state.pressed.down||state.pressed.right?1:state.pressed.up||state.pressed.left?-1:0;
 if(direction&&now-lastMenuNav>120){let index=elements.indexOf(document.activeElement);elements[(index+direction+elements.length)%elements.length].focus();lastMenuNav=now;}
 if(state.pressed.confirm){const el=elements.includes(document.activeElement)?document.activeElement:elements.find(el=>el.classList.contains('primary'))||elements[0];if(el.tagName==='BUTTON')el.click();else if(el.type==='checkbox'){el.checked=!el.checked;el.dispatchEvent(new Event('change'));}}
}
function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;
 try{
  const state=vr.sample(input.sample());frameCount++;$('#controller-status').textContent=input.pad?'Gamepad connected':'Keyboard + mouse';
  if(!$('#settings').hidden){$('#pad-details').textContent=input.pad?`${input.pad.id} · ${input.pad.mapping||'custom device mapping'}`:'Press a button on your controller to connect.';$('#pad-monitor').textContent=input.pad?`Axes: ${input.pad.axes.map((v,i)=>`${i}: ${v.toFixed(2)}`).join('  ')}\nPressed buttons: ${input.pad.buttons.map((b,i)=>b.pressed?i:null).filter(i=>i!==null).join(', ')||'none'}`:'No gamepad detected';}
  if(input.disconnected)pause('Controller disconnected. Reconnect or use keyboard and mouse.');
  if(!$('#settings').hidden){menuGamepad(state,now);if(state.pressed.pause)closeSettings();}
  else if(state.pressed.pause){if(mode==='playing')pause();else if(mode==='paused')$('#resume').click();}
  else if(mode!=='playing')menuGamepad(state,now);
  if(mode==='playing'&&$('#settings').hidden){
    if($('#auto-fire').checked||vr.active){aimRay();ray.far=sim.weapon.range;const hit=ray.intersectObjects([...enemyActors.values()].filter(a=>a.visible&&a.state!=='death').flatMap(a=>a.meshes),false)[0],wall=ray.intersectObjects(world.staticMeshes,false)[0];state.fire=state.fire||!!(hit&&(!wall||wall.distance>=hit.distance));}
    sim.update(dt,state);if(!vr.active){camera.position.set(sim.player.x,world.eyeHeight+sim.player.y,sim.player.z);camera.rotation.set(sim.pitch,sim.yaw,0);camera.fov=state.aim?43:65;camera.updateProjectionMatrix();camera.updateMatrixWorld();}else vr.sync(sim,world);
    weaponEffects?.update(dt,world.staticMeshes);updateActors(dt);enemyEffects?.update(sim,enemyActors);if(state.fire)shoot();
    for(const event of sim.events){if(event==='mopHit'){hitMarker=.18;sound('mopHit');}if(event==='mopMiss')sound('mopMiss');if(['reload','hurt','pickup'].includes(event))sound(event);if(event==='over'){
      best=Math.max(best,sim.score);save('puppet-web-best-v1',best);$('#pause-title').textContent='That’s a wrap.';$('#pause-detail').textContent=`${sim.score} points · ${sim.kills} puppets · ${Math.floor(sim.time)} seconds · ${sim.shotsFired} attacks · Wave ${sim.wave} · Best ${best}`;$('#resume').hidden=true;setMode('over');$('#restart').focus();}}
    sim.events=[];shotFlash=Math.max(0,shotFlash-dt);hitMarker=Math.max(0,hitMarker-dt);updateHUD();
  }
  if(mode==='menu'&&world&&!vr.active){camera.position.set(world.spawn.x,world.eyeHeight,world.spawn.z);camera.rotation.set(-.03,-.15+Math.sin(now*.0001)*.07,0);for(const actor of decorative)actor.update(dt);}
  updateLoopSound();updateMusic();
  if(world){vr.update(dt,sim,mode,state.pressed.teleport);drawWeapon();renderer.render(world.scene,camera);}
 }catch(error){reportError(error,{operation:'game frame'});if(mode==='playing')pause('Rendering or simulation failed. See Diagnostics.');}
}
renderer.setAnimationLoop(frame);
// Read-only state makes bug reports and smoke tests reproducible without a hidden cheat mode.
window.puppetDebug={getState:()=>({frame:frameCount,mode,episode,weaponEffects:weaponEffects?.snapshot(),trashSites:world?.trashSpawnPoints,vr:vr.active,perkTimers:sim?.perkTimers,cakes:sim?.cakes.map(c=>({x:c.x,z:c.z,landed:c.landed,fuse:c.fuse})),arena:world?.arena.key,timeOfDay:world?.timeOfDay,variantNote:world?.variantNote,teleports:world?.teleports,encounterMode:sim?.encounterMode,health:sim?.player.health,position:sim?{...sim.player}:null,yaw:sim?.yaw,ammo:sim?[...sim.ammo]:[],reloading:sim?.reloading,weapon:sim?.weaponIndex,weaponAnimation:weaponVisual?{state:weaponVisual.state,index:weaponVisual.index,texture:weaponVisual.texture}:null,wave:sim?.wave,enemies:sim?.enemies.length,corpses:sim?.corpses.length,animations:[...enemyActors.values(),...decorative].map(actor=>actor.snapshot()),targets:sim?.enemies.map(e=>({id:e.id,x:e.x,z:e.z,health:e.health,type:e.type,state:e.state,shield:e.shield,form:e.form})),projectiles:sim?.projectiles.map(p=>({kind:p.kind,x:p.x,y:p.y,z:p.z})),pickups:sim?.pickups.map(p=>({...p})),money:sim?.money,score:sim?.score,gamepad:input.pad?.id,meshes:world?.staticMeshes.length,bounds:world?.bounds})};
await selectEpisode(1);
