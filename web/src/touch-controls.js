// Episode 2: Joystick, JoystickR, MouseLookiPhone and FirstPersonControl.
export function movementAt(x,y){const dx=Math.max(-1,Math.min(1,(x-65)/30)),dy=Math.max(-1,Math.min(1,(y-60)/30)),length=Math.hypot(dx,dy)||1,amount=Math.max(Math.abs(dx),Math.abs(dy));return {x:dx/length*amount,y:-dy/length*amount,dx,dy};}
export class EpisodeTouch{
 constructor(input,element){this.input=input;this.element=element;this.pointers=new Map();this.pulses=new Set();this.delta={x:0,y:0};this.aim=false;
  for(const name of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])element.addEventListener(name,e=>this.handle(e),{passive:false});
 }
 point(e){const r=this.element.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*480,y:(r.bottom-e.clientY)/r.height*320};}
 handle(e){if(!this.input.active)return;e.preventDefault();const p=this.point(e),action=e.target.closest('[data-touch]')?.dataset.touch;
  if(e.type==='pointerdown'){
   const move=(this.input.leftHanded?p.x>310:p.x<170)&&p.y<150&&!action;if(move&&[...this.pointers.values()].some(p=>p.move))return;
   const look=!move&&!['switch','reload','aim','jump','teleport'].includes(action)&&![...this.pointers.values()].some(p=>p.look);
   this.pointers.set(e.pointerId,{...p,move,look,action});this.element.setPointerCapture(e.pointerId);
   if(action==='aim')this.aim=!this.aim;
   if(action==='fire')this.input.touch.fire=true;
   if(['reload','jump','teleport'].includes(action))this.pulses.add(action);
   if(move)this.move(p);this.paint();return;
  }
  const previous=this.pointers.get(e.pointerId);if(!previous)return;
  if(e.type==='pointermove'){
   if(previous.move)this.move(p);
   if(previous.look){this.delta.x+=p.x-previous.x;this.delta.y-=p.y-previous.y;}
   Object.assign(previous,p);return;
  }
  if(e.type==='pointerup'&&previous.action==='switch'){this.pulses.add('switch');this.aim=false;}
  this.pointers.delete(e.pointerId);if(previous.move){this.input.touch.moveX=this.input.touch.moveY=0;this.element.querySelector('#move-stick i').style.transform='';}
  this.input.touch.fire=[...this.pointers.values()].some(p=>p.action==='fire');this.paint();
 }
 move(p){const m=movementAt(p.x-(this.input.leftHanded?355:0),p.y);this.input.touch.moveX=m.x;this.input.touch.moveY=m.y;this.element.querySelector('#move-stick i').style.transform=`translate(${m.dx*50}%,${-m.dy*50}%)`;}
 paint(){for(const b of this.element.querySelectorAll('[data-touch]'))b.classList.toggle('pressed',b.dataset.touch==='aim'?this.aim:[...this.pointers.values()].some(p=>p.action===b.dataset.touch));}
 sample(){const data={x:this.delta.x,y:this.delta.y,pulses:new Set(this.pulses),aim:this.aim};this.delta={x:0,y:0};this.pulses.clear();return data;}
 clear(){for(const id of this.pointers.keys())if(this.element.hasPointerCapture(id))this.element.releasePointerCapture(id);this.pointers.clear();this.pulses.clear();this.delta={x:0,y:0};this.aim=false;this.input.touch.moveX=this.input.touch.moveY=0;this.input.touch.fire=false;this.element.querySelector('#move-stick i').style.transform='';this.paint();}
}
export function guardGameGestures(isPlaying){
 for(const name of ['gesturestart','gesturechange','gestureend'])document.addEventListener(name,e=>e.preventDefault(),{passive:false});
 document.addEventListener('touchmove',e=>{if(isPlaying()||e.touches.length>1)e.preventDefault();},{passive:false});
 document.addEventListener('touchstart',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
 document.addEventListener('dblclick',e=>{if(isPlaying())e.preventDefault();},{passive:false});
 document.addEventListener('contextmenu',e=>{if(isPlaying())e.preventDefault();});
 window.addEventListener('wheel',e=>{if(isPlaying()&&e.ctrlKey)e.preventDefault();},{passive:false});
}
