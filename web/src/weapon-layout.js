// Weapon atlas coordinates share the same layout as the canvas draw operation.
export function weaponLayout(width,height){const halfH=Math.min(height*.52,420);return {halfH,halfW:halfH*1.5,baseY:height-halfH,centerX:width/2};}
export function muzzlePixel(id,width,height){
 const {halfH,halfW,baseY,centerX}=weaponLayout(width,height);
 const [x,y]=({dualuzis:[.35,-.08],flamethrower:[.21,-.09],leafblower:[.14,-.405],ak47:[.21,.01]})[id]||[.18,-.05];
 return {x:centerX+x*halfW,y:baseY-y*halfH};
}
