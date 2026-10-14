// Playable VR loadouts: loadlevel.ButtonPress; stage-two overrides in weapon Start().
export const VR_WEAPONS=[
 {id:'ak47',name:'AK-47',damage:65,interval:.06,range:125,capacity:30,reserve:390,reload:1.8,pellets:1,automatic:true},
 {id:'flamethrower',name:'FLAMETHROWER',damage:100,interval:.05,range:25,capacity:100,reserve:500,reload:4,pellets:1,continuous:true,windup:.3,cone:.25,burn:3,recharge:5},
 {id:'katana',name:'KATANA',damage:200,interval:.6,range:9,capacity:0,reload:0,pellets:1,melee:true,cone:.6},
 {id:'leafblower',name:'LEAF BLOWER',damage:300,interval:.05,range:20,capacity:60,reserve:300,reload:2,pellets:1,continuous:true,windup:1,push:12},
 {id:'cake',name:'DYNAMITE CAKE',damage:100,interval:2,range:30,capacity:1,reload:0,pellets:1,perk:true,rechargeTime:35,delay:1.5},
 {id:'redbutton',name:'RED BUTTON',damage:10000,interval:2,range:200,capacity:1,reload:0,pellets:1,perk:true,rechargeTime:30,delay:.5}
];
export function vrSurvivalPhase(arena,spawned){
 const phase=spawned<10?0:spawned<40?1:spawned<90?2:3,chapterTwo=['lobby','parking'].includes(arena);
 const names=['grunt','fast','fish','bomber','chicken','strong','ninja','zombie','magician','magician','soldier','vampire'];
 let indices;
 if(phase===0)indices=[spawned%2];
 else if(chapterTwo)indices=phase===1?(arena==='parking'?[1,6,7,9,10,11]:[1,6,9,10]):(arena==='parking'?[0,1,2,3,4,5,6,7,9,10,11]:[0,1,2,3,4,5,6,9,10]);
 else indices=phase===1?(arena==='town'?[2,7,7]:[1,2,3]):(arena==='town'?[0,1,2,3,4,5,6,7]:[0,1,2,3,4,5]);
 return {phase:phase+1,cap:(chapterTwo?[5,6,9,12]:[4,5,8,10])[phase],interval:(chapterTwo?[3,2,1,1]:[3,2,2,1])[phase],types:indices.map(i=>names[i])};
}
