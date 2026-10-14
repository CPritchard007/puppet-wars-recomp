export function weaponFrame(clips,sim){
  let state='idle',time=sim.time;const fire=clips.fireAlt&&sim.shotsFired%2===0?'fireAlt':'fire';
  if(sim.weapon.continuous){
    if(sim.trigger&&!sim.reloading&&sim.ammo[sim.weaponIndex]>=1){state=sim.triggerTime<(sim.weapon.windup||0)?'beforefire':'fire';time=state==='beforefire'?sim.triggerTime:sim.triggerTime-(sim.weapon.windup||0);}
    else if(sim.releaseAge<clips.afterfire?.reduce((s,f)=>s+f.duration,0)){state='afterfire';time=sim.releaseAge;}
  }
  if(sim.reloading&&clips.reload?.length){state='reload';const duration=clips.reload.reduce((sum,f)=>sum+f.duration,0);time=(1-sim.reloading/sim.weapon.reload)*duration;}
  else if(!sim.weapon.continuous&&sim.fireAge!==null){const duration=clips[fire].reduce((sum,f)=>sum+f.duration,0);if(sim.fireAge<duration||sim.weapon.automatic&&sim.trigger){state=fire;time=sim.fireAge;}}
  const frames=clips[state];if(!frames?.length)throw new Error(`Missing ${sim.weapon.name} ${state} animation`);
  if(state==='idle'&&clips.idleLoopReverse&&frames.length>1){
    // Traverse the return leg without repeating either endpoint.
    const order=[...frames.keys(),...Array.from({length:frames.length-2},(_,i)=>frames.length-2-i)];
    const cycle=order.reduce((sum,i)=>sum+frames[i].duration,0);time=((time%cycle)+cycle)%cycle;
    let step=0;while(step<order.length-1&&time>=frames[order[step]].duration)time-=frames[order[step++]].duration;
    const index=order[step];return {...frames[index],state,index};
  }
  const duration=frames.reduce((sum,f)=>sum+f.duration,0);if(state==='idle'||state==='fire'&&(sim.weapon.automatic||sim.weapon.continuous))time%=duration;
  let index=0;while(index<frames.length-1&&time>=frames[index].duration){time-=frames[index++].duration;}
  return {...frames[index],state,index};
}
