// The source PackedSprite uses eight states for combinations of broken thirds.
export function damageSection(health,section,damage){
 health[section]=Math.max(0,health[section]-damage);
 const mask=(health[0]===0?1:0)|(health[1]===0?2:0)|(health[2]===0?4:0);
 return [0,1,2,5,3,7,4,6][mask];
}
