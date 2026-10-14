// EnemyAI8Trash.Shoot + EnemyShootGrenade.EnemyFire, original serialized values.
export const TRASH_ATTACK={duration:4.566667,releaseTimes:[1,1.3,1.8,2.3],range:100,startDelay:.2};
export function updateTrash(s,e,dt,emit){
 if(e.anchor){e.x=e.anchor.x;e.z=e.anchor.z;}
 e.hidden=false;e.shield=false;e.y=(e.anchor?.y??s.floorY??0)-(s.floorY??0);
 if(s.player.health<=0){e.animation='idle';return;}
 if(e.state!=='trashShoot'){
  e.animation='idle';
  if(e.age<TRASH_ATTACK.startDelay)return;
  const distance=Math.hypot(s.player.x-e.x,s.player.z-e.z);
  // PlayerClose is latched by Patrol in the source.
  e.playerClose ||= distance<TRASH_ATTACK.range;
  if(!e.playerClose)return;
  e.state='trashShoot';e.attackAge=0;e.shots=0;e.actionVersion=(e.actionVersion||0)+1;
  e.trashFacing=Math.atan2(s.player.x-e.x,s.player.z-e.z);
  const randomInt=(lo,hi)=>lo+Math.floor(s.random()*(hi-lo));
  e.launchSpeed=distance-(distance>=60?randomInt(10,25):distance>30?randomInt(15,20):randomInt(5,15));
  e.launchLift=distance>=60?randomInt(4,8):distance>30?randomInt(4,6):randomInt(2,4);
  s.events.push('trashAttack');
 }else e.attackAge+=dt;
 e.animation='attack';
 while(e.shots<TRASH_ATTACK.releaseTimes.length&&e.attackAge+1e-8>=TRASH_ATTACK.releaseTimes[e.shots]){
  if(s.arena.key!=='corridor'||Math.hypot(s.player.x-e.x,s.player.z-e.z)<60)emit(s,e);
  e.shots++;
 }
 if(e.attackAge>=TRASH_ATTACK.duration){e.state='trashReady';e.animation='idle';}
}

// StreetSet.DefultCoverPoints/MoveCoverPoints: local Unity coordinates.
export function townTrashSites(player){
 if(player.z>85&&player.x>-36)return [[-17.3,1,36],[25.4,1,61.14],[12.4,1,98]];
 if(player.x<=-36)return [[-47,1,70.2],[25.4,1,61.14],[12.4,1,98]];
 return [[-15.7,1,-19],[26,1,-3.6],[-17.5,1,36.3]];
}
