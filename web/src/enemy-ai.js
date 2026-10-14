import {clearSegment,validPoint} from './enemy-navigation.js';
// Behavior sources: recovered Assembly-UnityScript/EnemyAI*.cs; see docs/enemy-ai.md.
// Speeds, sizes and health are scaled for the existing 3.3-unit web puppet and survival waves.
const profile=(name,source,speed,health,extra={})=>({name,source,speed,health,damage:8,reach:2.2,windup:.5,recovery:1,scale:1,variant:0,coverStops:2,...extra});
export const ENEMY_TYPES={
 grunt:profile('Puppet','EnemyAI',3.4,77),
 fast:profile('Runner','EnemyAI02Fast01',5.1,62,{sprint:6.3,variant:1}),
 chicken:profile('Chicken thrower','EnemyAI03Shoter',2.8,85,{ranged:true,projectile:'chicken',shotDelay:3,variant:2}),
 fish:profile('Fish thrower','EnemyAI03Shoter',2.8,85,{ranged:true,projectile:'fish',shotDelay:1,variant:1}),
 soldier:profile('Soldier','EnemyAI03Shoter',3.2,110,{ranged:true,projectile:'tomato',shotDelay:1,burst:2,roll:true,variant:2}),
 bomber:profile('Bomber','EnemyAI04Suicidel',4.4,60,{damage:22,windup:.7,variant:1}),
 strong:profile('Strong puppet','EnemyAI05Strong1',2.1,210,{damage:18,reach:2.7,scale:1.3,variant:2}),
 ninja:profile('Ninja','EnemyAI06NINJA',5.3,95,{damage:10,variant:2}),
 zombie:profile('Zombie','EnemyAI07Zombie',1.8,105,{sprint:3.4,damage:10,revives:1,variant:2,coverStops:0}),
 trash:profile('Trash thrower','EnemyAI8Trash',0,115,{ranged:true,projectile:'tomato',shotDelay:2,stationary:true,variant:2}),
 magician:profile('Magician','EnemyAI10Magicion',3.1,150,{variant:1}),
 vampire:profile('Vampire','EnemyAI11Vempire',3.8,170,{sprint:6.2,damage:12,variant:1}),
 boss:profile('Brute boss','EnemyAI08BossLite',2.5,650,{damage:25,reach:3,scale:1.65,ranged:true,projectile:'grenade',shotDelay:2,boss:true}),
 clown:profile('Clown boss','EnemyAI11BossCLOWN-02',4.5,750,{damage:20,reach:2.8,scale:1.45,ranged:true,projectile:'fireball',shotDelay:1,burst:2,boss:true,variant:1}),
 elf:profile('Elf thrower','EnemyAI03Shoter',3.4,85,{ranged:true,projectile:'snowball',shotDelay:2}),
 kart:profile('Kart driver','Enemy12CarSimplePath',7,160,{damage:16,reach:2.5,windup:.6,variant:2})
};
export function createEnemy(type,pos,id,wave=1){
 const p=ENEMY_TYPES[type];if(!p)throw new Error(`Unknown enemy type: ${type}`);
 return {...pos,id,type,health:p.health*(1+(wave-1)*.08),maxHealth:p.health*(1+(wave-1)*.08),speed:p.speed,variant:p.variant,scale:p.scale,
   attack:0,flash:0,hitVersion:0,animation:'run',state:p.stationary?'hidden':'patrol',timer:p.stationary?.5:0,age:0,
   coverLeft:p.coverStops,coverIndex:-1,revives:p.revives||0,special:4,route:[],repath:0,y:0,shield:false,hidden:false,form:'puppet',shots:0};
}
export function enter(e,state,time=0){if(['windup','throw','fuse','magic','teleport','transform','defend','firebreath','jump','down','rise','roll','charge'].includes(state))e.actionVersion=(e.actionVersion||0)+1;e.state=state;e.timer=time;e.route=[];e.repath=0;}
export function enemyHit(s,e,damage){
 const p=ENEMY_TYPES[e.type];if(!p)return damage;
 if(e.shield||e.hidden||e.state==='rise'||e.state==='down')return 0;
 if(p.revives&&damage>=e.health&&e.revives>0){e.revives--;e.health=e.maxHealth*.65;e.speed=p.sprint;enter(e,'down',2);return 0;}
 if(e.type==='bomber'&&e.state==='fuse')return damage; // A lethal hit can interrupt the fuse.
 if(!p.boss){enter(e,p.roll?'roll':'stagger',p.roll?.7:1);e.speed=p.sprint||p.speed;}
 return damage;
}
function move(s,e,goal,speed,dt,moveBody){
 e.repath-=dt;
 if(e.repath<=0||!e.goal||Math.hypot(goal.x-e.goal.x,goal.z-e.goal.z)>2){e.route=s.navigation.route(e,goal);e.goal={...goal};e.repath=.65;}
 while(e.route.length&&Math.hypot(e.route[0].x-e.x,e.route[0].z-e.z)<.4)e.route.shift();
 const target=e.route[0];if(!target){e.animation='idle';return false;}
 let dx=target.x-e.x,dz=target.z-e.z,d=Math.hypot(dx,dz);const step=Math.min(d,speed*dt);const x=e.x,z=e.z;
 if(d>0){e.heading=Math.atan2(dx,dz);moveBody(e,dx/d*step,dz/d*step,s.bounds,s.obstacles,.65);}
 e.animation=Math.hypot(e.x-x,e.z-z)>.001?'run':'idle';return e.animation==='run';
}
function chooseCover(s,e){
 const points=s.navigation.cover;
 const candidates=points.map((p,i)=>({p,i,score:Math.hypot(p.x-e.x,p.z-e.z)+.25*Math.hypot(p.x-s.player.x,p.z-s.player.z)}))
  .filter(c=>c.i!==e.coverIndex&&Math.hypot(c.p.x-e.x,c.p.z-e.z)>2&&s.navigation.route(e,c.p).length).sort((a,b)=>a.score-b.score);
 const next=candidates[Math.min(candidates.length-1,Math.floor(s.random()*Math.min(3,candidates.length)))];
 if(next){e.coverIndex=next.i;e.cover=next.p;}else e.cover=null;
 return e.cover;
}
function relocate(s,e,nearPlayer=true){
 for(let i=0;i<24;i++){
  const angle=s.random()*Math.PI*2,r=6+s.random()*5;
  const anchor=nearPlayer?s.player:e;
  const p={x:anchor.x+Math.sin(angle)*r,z:anchor.z+Math.cos(angle)*r};
  if(validPoint(p,s.bounds,s.obstacles)&&(!nearPlayer||clearSegment(p,s.player,s.obstacles))){e.x=p.x;e.z=p.z;return true;}
 }
 return false;
}
function sightObstacles(s,e){return ENEMY_TYPES[e.type].stationary?s.obstacles.filter(b=>!(e.x>=b.minX&&e.x<=b.maxX&&e.z>=b.minZ&&e.z<=b.maxZ)):s.obstacles;}
function fire(s,e,kind){
 const p=ENEMY_TYPES[e.type];
 if(!clearSegment(e,s.player,sightObstacles(s,e)))return;
 const distance=Math.hypot(e.x-s.player.x,e.z-s.player.z);
 const duration=Math.max(.55,distance/(kind==='fireball'?16:12));
 s.projectiles.push({id:++s.effectId,owner:e.id,ignoredObstacles:p.stationary?s.obstacles.filter(b=>!sightObstacles(s,e).includes(b)):[],kind:kind||p.projectile,x:e.x,z:e.z,y:2.2,start:{x:e.x,z:e.z},target:{x:s.player.x,z:s.player.z},age:0,duration,damage:p.damage,radius:kind==='fireball'?1.5:2.3});
 s.events.push('enemyShot');
}
function melee(s,e){
 const p=ENEMY_TYPES[e.type];if(Math.hypot(e.x-s.player.x,e.z-s.player.z)<=p.reach+.3&&s.player.y<1.2&&clearSegment(e,s.player,s.obstacles))s.hurtPlayer(p.damage*(e.magicScale>1?1.5:1));
}
export function updateEnemy(s,e,dt,moveBody){
 const p=ENEMY_TYPES[e.type];if(!p)throw new Error(`Enemy ${e.id} has unsupported type ${e.type}`);
 e.age+=dt;e.timer-=dt;e.special-=dt;e.flash=Math.max(0,e.flash-dt);e.attack=Math.max(0,e.attack-dt);e.animation='idle';
 const d=Math.hypot(s.player.x-e.x,s.player.z-e.z),visible=clearSegment(e,s.player,sightObstacles(s,e));
 e.hidden=false;e.shield=false;e.y=0;if(p.stationary&&e.anchor){e.x=e.anchor.x;e.z=e.anchor.z;}
 if(s.player.health<=0){e.animation='celebrate';return;}
 if(e.state==='down'){e.animation='knockdown';if(e.timer<=0)enter(e,'rise',1);return;}
 if(e.state==='rise'){e.animation='recover';if(e.timer<=0)enter(e,'pursue');return;}
 if(e.state==='stagger'){e.animation='hit';if(e.timer<=0)enter(e,p.stationary?'hidden':'pursue',p.stationary?.5:0);return;}
 if(e.state==='roll'){const side=e.side||1;move(s,e,{x:e.x+Math.cos(s.yaw)*4*side,z:e.z-Math.sin(s.yaw)*4*side},6,dt,moveBody);if(e.timer<=0){e.side=-side;enter(e,'patrol');}return;}
 if(e.state==='windup'){e.animation='attack';if(e.timer<=0){melee(s,e);enter(e,'recoverAttack',p.recovery);}return;}
 if(e.state==='recoverAttack'){e.animation='attack';if(e.timer<=0){if(e.type==='kart')enter(e,'escape',5+s.random()*5);else enter(e,'pursue');}return;}
 if(e.state==='fuse'){e.animation='hit';e.flash=.15;if(e.timer<=0){if(d<5&&visible)s.hurtPlayer(p.damage);s.effects.push({id:++s.effectId,x:e.x,z:e.z,y:1,radius:5,age:0,life:1,kind:'bomberBlast'});s.killEnemy(e,false);}return;}
 if(e.state==='throw'){
  e.animation='attack';if(e.timer<=0){fire(s,e);e.shots++;if(e.shots<(p.burst||1))e.timer=p.shotDelay;else{e.shots=0;enter(e,p.stationary?'hidden':'coverWait',p.shotDelay+.3);}}return;
 }
 if(e.state==='hidden'){e.hidden=e.timer>0;if(e.timer<=0&&d<100&&visible){e.hidden=false;enter(e,'throw',.9);}return;}
 if(e.state==='teleport'){e.shield=true;e.hidden=e.timer<.5;e.animation='celebrate';if(e.timer<=0){relocate(s,e);e.special=8;enter(e,'pursue');}return;}
 if(e.state==='magic'){e.shield=true;e.animation='celebrate';if(e.timer<=0){e.magicScale=s.random()<.5?.55:1.65;e.magicUntil=s.time+17;enter(e,'teleport',1);e.special=8;}return;}
 if(e.magicUntil&&s.time>e.magicUntil){e.magicScale=1;e.magicUntil=0;}
 if(e.state==='transform'){e.shield=true;e.animation='celebrate';if(e.timer<=0){e.form=e.form==='bat'?'puppet':'bat';e.special=8;enter(e,'patrol');e.coverLeft=2;}return;}
 if(e.form==='bat')e.y=1.5+Math.sin(e.age*6)*.25;
 if(e.state==='defend'){e.shield=true;e.animation='idle';if(e.timer<=0)enter(e,'firebreath',1.5);return;}
 if(e.state==='firebreath'){e.animation='attack';if(e.timer<=0){fire(s,e,'fireball');enter(e,'charge',3);e.chargeTarget={...s.player};}return;}
 if(e.state==='charge'){
  e.shield=e.type==='boss';move(s,e,e.chargeTarget||s.player,p.speed*2.2,dt,moveBody);
  if(p.stationary){enter(e,'hidden',.5);return;}
 if(d<p.reach&&visible){melee(s,e);e.special=7;enter(e,'coverWait',1.5);}else if(e.timer<=0){e.special=7;enter(e,'patrol');e.coverLeft=2;}return;
 }
 if(e.state==='jump'){
  e.y=Math.sin(Math.max(0,Math.min(1,1-e.timer/.6))*Math.PI)*2;
  move(s,e,e.jumpTarget,p.speed*1.5,dt,moveBody);if(e.timer<=0)enter(e,'pursue');return;
 }
 if(e.state==='escape'){
  if(!e.cover)chooseCover(s,e);if(e.cover)move(s,e,e.cover,p.speed,dt,moveBody);
  if(e.timer<=0||e.cover&&Math.hypot(e.x-e.cover.x,e.z-e.cover.z)<1){chooseCover(s,e);enter(e,'patrol');}return;
 }
 if(e.state==='reposition'){
  if(!e.cover)chooseCover(s,e);
  if(e.cover){move(s,e,e.cover,e.speed,dt,moveBody);if(Math.hypot(e.x-e.cover.x,e.z-e.cover.z)<1)enter(e,'patrol');}
  else enter(e,'patrol');return;
 }
 if(e.state==='coverWait'){
  if(e.timer<=0){e.coverLeft--;e.cover=null;if(e.type==='ninja'){e.jumpTarget={x:e.x+Math.sin(s.yaw+Math.PI/2)*4,z:e.z+Math.cos(s.yaw+Math.PI/2)*4};enter(e,'jump',.6);}else enter(e,p.ranged?'reposition':'patrol');}return;
 }
 // Specialist phases have their own timers; no frame-rate-dependent random rolls.
 if(e.special<=0){
  if(e.type==='magician'){enter(e,e.magicUntil?'teleport':'magic',1.2);return;}
  if(e.type==='vampire'){enter(e,'transform',1);return;}
  if(e.type==='clown'){enter(e,'defend',2+s.random()*2);return;}
  if(e.type==='boss'){e.chargeTarget={...s.player};enter(e,'charge',3);return;}
  if(e.type==='ninja'){e.jumpTarget={...s.player};enter(e,'jump',.6);e.special=5;return;}
 }
 if(p.stationary){enter(e,'hidden',.5);return;}
 if(d<p.reach&&visible){enter(e,e.type==='bomber'?'fuse':'windup',p.windup);e.animation='attack';return;}
 if(p.ranged&&visible&&d>=p.reach&&d<28&&e.attack<=0){enter(e,'throw',p.roll?.5:1);e.attack=p.shotDelay+1.3;return;}
 if(e.type==='kart'&&e.state==='patrol'&&d>8){if(!e.cover)chooseCover(s,e);if(e.cover){move(s,e,e.cover,p.speed,dt,moveBody);if(Math.hypot(e.x-e.cover.x,e.z-e.cover.z)<1){e.cover=null;e.coverLeft--;}if(e.coverLeft>0)return;}}
 if(e.state==='patrol'&&e.coverLeft>0&&d>8&&e.type!=='zombie'){
  if(!e.cover)chooseCover(s,e);
  if(e.cover){move(s,e,e.cover,e.speed,dt,moveBody);if(Math.hypot(e.x-e.cover.x,e.z-e.cover.z)<1)enter(e,'coverWait',1);return;}
 }
 e.state='pursue';move(s,e,s.player,e.form==='bat'?p.sprint:e.speed,dt,moveBody);
}
export function updateProjectiles(s,dt){
 s.projectiles=s.projectiles.filter(p=>{
  const before={x:p.x,z:p.z};p.age+=dt;const t=Math.min(1,p.age/p.duration);
  p.x=p.start.x+(p.target.x-p.start.x)*t;p.z=p.start.z+(p.target.z-p.start.z)*t;p.y=2.2*(1-t)+Math.sin(t*Math.PI)*(p.kind==='fireball'?0:3);
  const wall=!clearSegment(before,p,s.obstacles.filter(b=>!p.ignoredObstacles?.includes(b)));
  if(wall||t>=1){
   if(!wall&&Math.hypot(p.x-s.player.x,p.z-s.player.z)<p.radius&&s.player.y<1.5&&clearSegment(p,s.player,s.obstacles)){s.hurtPlayer(p.damage);if(p.kind==='fish')s.fishSplat={age:0,rotation:s.random()*Math.PI*2};}
   s.effects.push({id:++s.effectId,x:p.x,z:p.z,y:Math.max(.2,p.y),radius:p.radius,age:0,kind:'impact'});return false;
  }return true;
 });
 s.effects=s.effects.filter(e=>(e.age+=dt)<(e.life??.45));
}
export function waveTypes(wave){
 const basic=['grunt','fast','chicken','fish','strong','bomber'];
 if(wave>=2)basic.push('ninja','zombie','soldier');if(wave>=3)basic.push('trash','magician','vampire','kart','elf');
 if(wave%4===0)basic.unshift('boss');if(wave%5===0)basic.unshift('clown');return basic;
}
