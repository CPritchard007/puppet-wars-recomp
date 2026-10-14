import { EXTRA_WEAPONS } from './extra-weapons.js';
import { VR_WEAPONS, vrSurvivalPhase } from './vr-content.js';
import { clearSegment,validPoint } from './enemy-navigation.js';
import { EnemyNavigation } from './enemy-navigation.js';
import { createEnemy,enemyHit,updateEnemy,updateProjectiles,waveTypes } from './enemy-ai.js';
export const WEAPONS = [
  // PistolGun.Start(), upgrade stage 0; clip and reload defaults from constructor.
  { name:'PISTOL', damage:35, interval:.7, range:35, capacity:30, reload:2, pellets:1 },
  // Initial web tuning for the shotgun; full original upgrade tree is not ported yet.
  { name:'SHOTGUN', damage:22, interval:.95, range:30, capacity:8, reload:2.6, pellets:6 },
  { id:'mop', name:'MOP', damage:50, interval:.6, range:5, capacity:0, reload:0, pellets:1, melee:true, cone:Math.acos(.9), hitDelay:.3 },
  ...VR_WEAPONS,...EXTRA_WEAPONS
];
export function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
export function blocked(x,z,radius,obstacles){return obstacles.some(b=>x+radius>b.minX&&x-radius<b.maxX&&z+radius>b.minZ&&z-radius<b.maxZ);}
export function moveBody(body,dx,dz,bounds,obstacles,radius=.6){
  // Substeps prevent tunnelling when a tab stalls or the player sprints into a wall.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));
  for(let i=0;i<steps;i++){
    const x=clamp(body.x+dx/steps,bounds.minX+radius,bounds.maxX-radius);
    if(!blocked(x,body.z,radius,obstacles))body.x=x;
    const z=clamp(body.z+dz/steps,bounds.minZ+radius,bounds.maxZ-radius);
    if(!blocked(body.x,z,radius,obstacles))body.z=z;
  }
}
export class Simulation {
  constructor({spawn={x:0,z:0},bounds={minX:-40,maxX:40,minZ:-40,maxZ:40},obstacles=[],coverPoints=[],random=Math.random,canSpawn=()=>true,canOccupySpawn=()=>true,deathDurations={},projectileOrigin=null,trashSitesForPlayer=null,arena={key:'studio'},spawnPoints=[],trashSpawnPoints=[],encounterMode='expanded',loadout=null,startingWeapon=0}={}){
    this.deathDurations=deathDurations;this.trashSpawnPoints=trashSpawnPoints;this.trashSitesForPlayer=trashSitesForPlayer;this.arena=arena;this.spawnPoints=spawnPoints;this.encounterMode=encounterMode;this.loadout=loadout||WEAPONS.map((_,i)=>i);this.startingWeapon=startingWeapon;this.navigation=new EnemyNavigation(bounds,obstacles,coverPoints);this.canSpawn=canSpawn;this.canOccupySpawn=canOccupySpawn;this.projectileOrigin=projectileOrigin;this.spawn=spawn;this.bounds=bounds;this.obstacles=obstacles;this.random=random;this.reset();
  }
  reset(){this.player={...this.spawn,health:100,y:0,vy:0};this.yaw=0;this.pitch=0;this.wave=0;this.kills=0;this.score=0;this.money=0;this.time=0;this.enemies=[];this.corpses=[];this.pickups=[];this.projectiles=[];this.effects=[];this.fishSplat=null;this.effectId=0;this.weaponIndex=this.startingWeapon;this.ammo=WEAPONS.map(w=>w.capacity);this.reserve=WEAPONS.map((w,i)=>w.reserve??[120,40,0][i]??0);this.perkTimers=WEAPONS.map(()=>0);this.pendingAttacks=[];this.cakes=[];this.triggerTime=0;this.trigger=false;this.releaseAge=10;this.totalSpawned=0;this.nextTrashKill=12;this.trashSerial=0;this.spawnTimer=3;this.teleportCooldown=0;this.shotsFired=0;this.damageDealt=0;this.fireAge=null;this.cooldown=0;this.reloading=0;this.nextWave=3;this.waveQueue=[];this.waveSpawnTimer=0;this.waveSpawnInterval=3;this.waveLiveCap=4;this.hurt=0;this.defeatAge=0;this.ended=false;this.events=[];}
  get weapon(){return WEAPONS[this.weaponIndex];}
  reload(){if(!this.weapon.melee&&!this.weapon.perk&&!this.reloading&&this.ammo[this.weaponIndex]<this.weapon.capacity&&this.reserve[this.weaponIndex]>0){this.reloading=this.weapon.reload;this.events.push('reload');}}
  switchWeapon(){if(this.reloading)return;this.selectWeapon(this.loadout[(this.loadout.indexOf(this.weaponIndex)+1)%this.loadout.length]);}
  selectWeapon(index){if(this.reloading||!this.loadout.includes(index)||!WEAPONS[index])return false;this.weaponIndex=index;this.fireAge=null;this.triggerTime=0;this.cooldown=.25;return true;}
  teleport(point){if(this.teleportCooldown>0||!validPoint(point,this.bounds,this.obstacles,.7))return false;this.player.x=point.x;this.player.z=point.z;this.player.y=0;this.player.vy=0;if(Number.isFinite(point.rotation))this.yaw=point.rotation;this.teleportCooldown=6;this.events.push('teleport');return true;}
  shot(){if(this.ended||this.cooldown>0||this.reloading||this.perkTimers[this.weaponIndex]>0||this.triggerTime<(this.weapon.windup||0))return false;if(!this.weapon.melee&&this.ammo[this.weaponIndex]<1){this.reload();return false;}if(!this.weapon.melee)this.ammo[this.weaponIndex]--;if(!this.weapon.automatic&&!this.weapon.continuous||this.fireAge===null||!this.trigger)this.fireAge=0;this.cooldown=this.weapon.interval;this.shotsFired++;if(this.weapon.perk){this.perkTimers[this.weaponIndex]=this.weapon.rechargeTime;this.pendingAttacks.push({kind:this.weapon.id,delay:this.weapon.delay,x:this.player.x,z:this.player.z,yaw:this.yaw});}if(this.weapon.hitDelay)this.pendingAttacks.push({kind:'melee',delay:this.weapon.hitDelay,weapon:this.weapon,direction:{x:-Math.sin(this.yaw),y:0,z:-Math.cos(this.yaw)}});this.events.push('shot');return true;}
  hurtPlayer(damage){if(this.ended)return;this.player.health=Math.max(0,this.player.health-damage);this.hurt=.35;this.events.push('hurt');}
  killEnemy(enemy,reward=true){if(enemy.dead)return;if(enemy.type==='trash')this.events.push('trashDeath');enemy.dead=true;enemy.health=0;enemy.shield=false;enemy.hidden=false;this.corpses.push({...enemy,animation:'death',deathAge:0,deathDuration:(this.deathDurations[enemy.type==='vampire'&&enemy.form==='bat'?'bat':enemy.type]??2.45)+.3});
    if(reward){this.kills++;this.score+=100;this.events.push('kill');this.pickups.push({x:enemy.x,z:enemy.z,kind:'money',amount:enemy.type==='strong'?60:35});if(this.kills%3===0)this.pickups.push({x:enemy.x,z:enemy.z,kind:this.kills%6===0?'health':'ammo',amount:20});}}
  damageEnemy(enemy,damage){
    if(enemy.health<=0)return false;const applied=enemyHit(this,enemy,damage);if(applied<=0)return false;
    this.damageDealt+=Math.min(enemy.health,applied);enemy.health-=applied;enemy.flash=.15;enemy.hitVersion=(enemy.hitVersion||0)+1;
    if(enemy.health<=0)this.killEnemy(enemy);else if(enemy.type==='trash'&&this.time>=(enemy.nextHitSound??0)){this.events.push('trashHit'+Math.min(2,Math.floor(this.random()*3)));enemy.nextHitSound=this.time+.15;}return true;
  }
  spawnTrash(){
    if(this.enemies.some(e=>e.type==='trash'&&e.health>0))return false;
    // Deliberately bypass walking/spawn collision rejection: source anchors sit in bins.
    // No random-floor fallback is allowed for this stationary encounter.
    const sites=(this.trashSitesForPlayer?.(this.player)||this.trashSpawnPoints).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.x>this.bounds.minX&&p.x<this.bounds.maxX&&p.z>this.bounds.minZ&&p.z<this.bounds.maxZ);
    if(!sites.length)return false;
    const site=sites[Math.min(sites.length-1,Math.floor(this.random()*sites.length))];
    const e=createEnemy('trash',site,`trash-${++this.trashSerial}`,Math.max(1,this.wave));
    e.anchor={...site};e.y=(site.y??this.floorY??0)-(this.floorY??0);e.siteId=site.id;this.enemies.push(e);return true;
  }
  spawnWave(){
    if(this.waveQueue.length)return;
    this.wave++;const count=Math.min(4+this.wave*2,24);
    const types=(this.arena.key==='snow'?['grunt','fast','elf','fish','bomber','chicken','strong']:waveTypes(this.wave)).filter(t=>t!=='trash');
    this.waveQueue=Array.from({length:count},(_,i)=>({type:types[i%types.length],id:`${this.wave}-${i}`}));
    // APK EnemySpawn waits between successful single spawns and caps live enemies.
    // Reuse the recovered survival pacing for this web-only expanded roster.
    const phase=Math.min(3,this.wave-1);
    this.waveSpawnInterval=[3,2,2,1][phase];this.waveLiveCap=[4,5,8,10][phase];
    this.waveSpawnTimer=0;this.events.push('wave');
  }
  validSpawnPosition(p){
    return validPoint(p,this.bounds,this.obstacles,1)&&this.canOccupySpawn(p.x,p.z)&&
      (this.arena.key!=='corridor'||this.navigation.route(p,this.player).length>0);
  }
  updateWaveSpawns(dt){
    if(!this.waveQueue.length||this.ended)return;
    this.waveSpawnTimer=Math.max(0,this.waveSpawnTimer-dt);
    if(this.waveSpawnTimer>1e-8||this.enemies.filter(e=>e.health>0&&e.type!=='trash').length>=this.waveLiveCap)return;
    let pos=null;
    for(let attempt=0;attempt<100;attempt++){
      const anchor=attempt<this.spawnPoints.length?this.spawnPoints[attempt]:null;
      const x=anchor?.x??(this.bounds.minX+3+this.random()*(this.bounds.maxX-this.bounds.minX-6)),z=anchor?.z??(this.bounds.minZ+3+this.random()*(this.bounds.maxZ-this.bounds.minZ-6));
      if(Math.hypot(x-this.player.x,z-this.player.z)>12&&this.validSpawnPosition({x,z})&&this.canSpawn(x,z,this.player)){pos={x,z};break;}
    }
    if(!pos){this.waveSpawnTimer=.5;return;}
    const next=this.waveQueue.shift();this.enemies.push(createEnemy(next.type,pos,next.id,this.wave));
    this.waveSpawnTimer=this.waveSpawnInterval;
  }
  updateSpecials(dt){
    WEAPONS.forEach((w,i)=>{this.perkTimers[i]=Math.max(0,this.perkTimers[i]-dt);if(w.perk&&this.perkTimers[i]===0)this.ammo[i]=1;if(w.recharge&&(!this.trigger||i!==this.weaponIndex)&&!this.reloading)this.ammo[i]=Math.min(w.capacity,this.ammo[i]+w.recharge*dt);});
    for(const a of this.pendingAttacks){a.delay-=dt;if(a.delay>0||a.done)continue;a.done=true;
      if(a.kind==='melee'){
        let hit=false;const w=a.weapon,d=a.direction;
        for(const e of this.enemies){
          if(e.hidden||e.health<=0)continue;
          const x=e.x-this.player.x,y=(e.y||0)-this.player.y,z=e.z-this.player.z,length=Math.hypot(x,y,z);
          if(length>w.range||length>0&&(x*d.x+y*d.y+z*d.z)/length<Math.cos(w.cone)||!clearSegment(this.player,e,this.obstacles))continue;
          if(this.damageEnemy(e,w.damage))hit=true;
        }
        this.events.push(a.weapon.id+(hit?'Hit':'Miss'));
      }
      if(a.kind==='redbutton'){for(const e of this.enemies)this.killEnemy(e);this.effects.push({id:++this.effectId,kind:'blast',x:this.player.x,z:this.player.z,y:1,radius:20,age:0});}
      if(a.kind==='cake')this.cakes.push({id:++this.effectId,kind:'cake',x:a.x,z:a.z,y:1.8,vx:-Math.sin(a.yaw)*15,vz:-Math.cos(a.yaw)*15,vy:5,age:0,fuse:8,landed:false});
    }this.pendingAttacks=this.pendingAttacks.filter(a=>!a.done);
    for(const c of this.cakes){c.age+=dt;if(!c.landed){const next={x:c.x+c.vx*dt,z:c.z+c.vz*dt};if(validPoint(next,this.bounds,this.obstacles,0)&&clearSegment(c,next,this.obstacles)){c.x=next.x;c.z=next.z;}else c.vx=c.vz=0;c.vy-=18*dt;c.y+=c.vy*dt;if(c.y<=.3){c.y=.3;c.landed=true;}}
      else{c.fuse-=dt;if(c.fuse<=0){c.dead=true;for(const e of this.enemies)if(Math.hypot(e.x-c.x,e.z-c.z)<20&&clearSegment(c,e,this.obstacles))this.damageEnemy(e,100);this.effects.push({id:++this.effectId,kind:'blast',x:c.x,y:.3,z:c.z,radius:20,age:0});}}
    }this.cakes=this.cakes.filter(c=>!c.dead);
  }
  updateVRSpawns(dt){
    const p=vrSurvivalPhase(this.arena.key,this.totalSpawned);this.wave=p.phase;this.spawnTimer-=dt;if(this.spawnTimer>0||this.enemies.length>=p.cap)return;
    const candidates=this.spawnPoints.length?this.spawnPoints:[this.spawn];let pos=null;
    for(let i=0;i<60;i++){const base=candidates[Math.floor(this.random()*candidates.length)],q={x:base.x+(i>candidates.length?(this.random()-.5)*10:0),z:base.z+(i>candidates.length?(this.random()-.5)*10:0)};if(this.validSpawnPosition(q)&&Math.hypot(q.x-this.player.x,q.z-this.player.z)>5){pos=q;break;}}
    if(pos){const type=p.types[Math.floor(this.random()*p.types.length)];this.enemies.push(createEnemy(type,pos,`vr-${this.totalSpawned++}`,p.phase));this.spawnTimer=p.interval;}else this.spawnTimer=.5;
  }
  updateDefeat(dt){
    if(!this.ended)return;this.defeatAge+=dt;
    for(const e of this.enemies){e.victoryDelay=Math.max(0,e.victoryDelay-dt);if(e.victoryDelay===0)e.animation='celebrate';}
    for(const c of this.corpses)c.deathAge+=dt;this.corpses=this.corpses.filter(c=>c.deathAge<(c.deathDuration??2.75));
  }
  update(dt,input){
    if(this.ended)return;dt=Math.min(.05,Math.max(0,dt));this.time+=dt;if(this.fishSplat&&(this.fishSplat.age+=dt)>=2)this.fishSplat=null;this.teleportCooldown=Math.max(0,this.teleportCooldown-dt);
    if(input.fire){this.triggerTime=this.trigger?this.triggerTime+dt:dt;this.releaseAge=0;}else{if(this.trigger)this.releaseAge=0;this.releaseAge+=dt;this.triggerTime=0;}this.trigger=!!input.fire;
    this.updateSpecials(dt);
    if(this.fireAge!==null)this.fireAge+=dt;
    for(const corpse of this.corpses)corpse.deathAge+=dt;this.corpses=this.corpses.filter(c=>c.deathAge<(c.deathDuration??2.75));
    this.cooldown=Math.max(0,this.cooldown-dt);this.hurt=Math.max(0,this.hurt-dt);
    if(this.reloading>0){this.reloading-=dt;if(this.reloading<=0){this.reloading=0;const i=this.weaponIndex,n=Math.min(this.weapon.capacity-this.ammo[i],this.reserve[i]);this.ammo[i]+=n;this.reserve[i]-=n;}}
    if(input.pressed.reload)this.reload();if(input.pressed.switch)this.switchWeapon();
    this.scopeAge=input.aim&&this.weapon.scopeFov&&!this.reloading?(this.scopeAge||0)+dt:0;
    const aimScale=this.scopeAge>=.5?.2:1;
    this.yaw-=(input.touchYaw||0)*(this.scopeAge>=.5?.3:1);if(input.touchPitch)this.pitch=clamp(this.pitch-input.touchPitch,-20*Math.PI/180,15*Math.PI/180);
    this.yaw-=(input.lookX*2.3*dt+input.mouseX*.002)*aimScale;this.pitch=clamp(this.pitch-(input.lookY*1.7*dt+input.mouseY*.002)*aimScale,-1.25,1.25);
    const speed=input.moveY<0?10:6;const touchSpeed=Math.abs(input.moveY)>Math.abs(input.moveX)?speed:6;const x=input.moveX*(input.touchMovement?touchSpeed:6),z=input.moveY*(input.touchMovement?touchSpeed:speed);
    moveBody(this.player,(x*Math.cos(this.yaw)+z*Math.sin(this.yaw))*dt,(-x*Math.sin(this.yaw)+z*Math.cos(this.yaw))*dt,this.bounds,this.obstacles);
    if(input.pressed.jump&&this.player.y===0)this.player.vy=6;
    this.player.vy-=18*dt;this.player.y=Math.max(0,this.player.y+this.player.vy*dt);if(!this.player.y)this.player.vy=0;
    for(const e of this.enemies){
      if(e.health<=0)continue;
      // Accept old saved/test entities as ordinary puppets.
      if(!e.type)Object.assign(e,{...createEnemy('grunt',e,e.id||'legacy',this.wave||1),...e,type:'grunt'});
      const cake=this.cakes.find(c=>c.landed&&!c.dead);
      if(cake&&!e.shield&&e.type!=='trash'){e.animation='run';moveBody(e,(cake.x-e.x)*Math.min(1,e.speed*dt/Math.max(.1,Math.hypot(cake.x-e.x,cake.z-e.z))),(cake.z-e.z)*Math.min(1,e.speed*dt/Math.max(.1,Math.hypot(cake.x-e.x,cake.z-e.z))),this.bounds,this.obstacles,.7);}else updateEnemy(this,e,dt,moveBody);
      if(e.burning>0){e.burning-=dt;this.damageEnemy(e,8*dt);}
    }
    updateProjectiles(this,dt);
    this.enemies=this.enemies.filter(e=>e.health>0);
    this.pickups=this.pickups.filter(p=>{if(Math.hypot(p.x-this.player.x,p.z-this.player.z)>2)return true;if(p.kind==='health')this.player.health=Math.min(100,this.player.health+(p.amount??20));else if(p.kind==='money'){const amount=p.amount??35;this.money+=amount;this.score+=amount;}else{WEAPONS.forEach((w,i)=>{if(!w.melee&&!w.perk)this.reserve[i]+=w.capacity;});}this.events.push('pickup');return false;});
    if(this.kills>=this.nextTrashKill&&this.spawnTrash())this.nextTrashKill=this.kills+12;
    if(this.encounterMode==='vr'){this.updateVRSpawns(dt);}else{if(!this.waveQueue.length&&!this.enemies.some(e=>e.type!=='trash')){this.nextWave-=dt;if(this.nextWave<=0){this.spawnWave();this.nextWave=4;this.reserve[0]+=15;this.reserve[1]+=4;}}this.updateWaveSpawns(dt);}
    if(this.player.health<=0){this.ended=true;this.defeatAge=0;this.trigger=false;this.scopeAge=0;this.projectiles=[];this.effects=[];this.cakes=[];this.pendingAttacks=[];for(const e of this.enemies){e.state='victory';e.animation='idle';e.hidden=false;e.shield=false;e.victoryDelay=this.random();}this.events.push('over');}
  }
}
