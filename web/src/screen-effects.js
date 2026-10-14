// The original PlayAnimationFishBK rotates the splat and removes it after 2s.
const tintedAtlases=new WeakMap();
export function fishSplatFrame(data,age){return data.frames[Math.min(data.frames.length-1,Math.floor(age*data.fps))];}
export function drawFishSplat(ctx,asset,splat,width,height){
 if(!splat||splat.age>=2)return;
 if(!asset)throw new Error('Missing recovered fish screen-splat asset');
 const source=asset.map.image;
 let image=tintedAtlases.get(source);
 if(!image){image=document.createElement('canvas');image.width=source.width;image.height=source.height;const c=image.getContext('2d');c.drawImage(source,0,0);c.globalCompositeOperation='source-in';c.fillStyle='rgb(0,208,42)';c.fillRect(0,0,image.width,image.height);tintedAtlases.set(source,image);}
 const [u,v,w,h]=fishSplatFrame(asset.data,splat.age).uv;
 const [left,top,right,bottom]=fishSplatFrame(asset.data,splat.age).bounds;
 const size=Math.min(width,height)*.55;
 ctx.save();ctx.translate(width/2,height/2);ctx.rotate(splat.rotation);ctx.globalAlpha=.9;
 ctx.drawImage(image,Math.round(u*image.width),Math.round((1-v-h)*image.height),Math.max(1,Math.round(w*image.width)),Math.max(1,Math.round(h*image.height)),left*size,-top*size,(right-left)*size,(top-bottom)*size);ctx.restore();
}
