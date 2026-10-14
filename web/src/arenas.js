export const ARENAS=[
 {id:1,key:'studio',name:'The studio',description:'Original studio set',defaultPeriod:'day'},
 {id:2,key:'lobby',name:'The lobby',description:'Elevators and lobby cover',defaultPeriod:'day'},
 {id:3,key:'town',name:'Town',description:'Houses, streets and parked cars',defaultPeriod:'night'},
 {id:4,key:'parking',name:'Parking lot',description:'Garage and parking barriers',defaultPeriod:'night'},
 {id:5,key:'snow',name:'Snow set',description:'Original Christmas arena',defaultPeriod:'day',periods:['day'],legacy:true},
 {id:6,key:'corridor',name:'The corridor',description:'Original corridor set',defaultPeriod:'day',legacy:true}
];

export function arenaScene(arena,period){if(!(arena.periods||['day','night']).includes(period))throw new Error(`Unknown lighting variant ${period}`);if(arena.legacy)return `assets/legacy/${arena.key}-${period}/scene.json`;return period===arena.defaultPeriod?`assets/vr/${arena.key}/scene.json`:`assets/variants/${arena.key}-${period}/scene.json`;}
