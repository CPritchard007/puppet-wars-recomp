export const ARENAS=[
 {id:1,key:'studio',name:'The studio',description:'Original studio set',defaultPeriod:'day'},
 {id:2,key:'lobby',name:'The lobby',description:'Elevators and lobby cover',defaultPeriod:'day'},
 {id:3,key:'town',name:'Town',description:'Houses, streets and parked cars',defaultPeriod:'night'},
 {id:4,key:'parking',name:'Parking lot',description:'Garage and parking barriers',defaultPeriod:'night'}
];

export function arenaScene(arena,period){if(!['day','night'].includes(period))throw new Error(`Unknown lighting variant ${period}`);return period===arena.defaultPeriod?`assets/vr/${arena.key}/scene.json`:`assets/variants/${arena.key}-${period}/scene.json`;}
