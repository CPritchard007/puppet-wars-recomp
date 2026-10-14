import * as THREE from 'three';
export class PickupSprite extends THREE.Sprite{
 constructor(kind,asset){if(!asset?.frames?.length)throw new Error(`Missing original pickup animation: ${kind}`);const map=asset.map.clone();map.needsUpdate=true;super(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));this.asset=asset;this.kind=kind;this.animate(0);}
 animate(time){const f=this.asset.frames[Math.floor(time*this.asset.fps)%this.asset.frames.length],[u,v,w,h]=f.uv,[left,top,right,bottom]=f.bounds;this.material.map.repeat.set(w,h);this.material.map.offset.set(u,v);this.scale.set((right-left)*.8,(top-bottom)*.8,1);this.center.set(-left/(right-left),-bottom/(top-bottom));}
 dispose(){this.removeFromParent();this.material.map.dispose();this.material.dispose();}
}
