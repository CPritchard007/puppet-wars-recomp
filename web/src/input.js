import {EpisodeTouch,guardGameGestures} from './touch-controls.js';
export const PROFILES = {
  standard: { teleport:4, fire: 7, aim: 6, reload: 2, switch: 3, jump: 0, pause: 9, moveX: 0, moveY: 1, lookX: 2, lookY: 3 },
  // InputManager.asset: Fire1 button 0, Fire2 button 1, Fire3 button 2, Jump button 3.
  // Fire2 -> aim and Fire3 -> reload are web bindings; the APK gameplay itself used touch.
  legacy: { teleport:4, fire: 0, aim: 1, reload: 2, switch: 5, jump: 3, pause: 9, moveX: 0, moveY: 1, lookX: 2, lookY: 3 }
};
export function deadzone(value, threshold = 0.19) {
  if (!Number.isFinite(value)) return 0;
  const v = Math.max(-1, Math.min(1,value));
  return Math.abs(v) <= threshold ? 0 : Math.sign(v) * (Math.abs(v) - threshold) / (1 - threshold);
}
export function gamepadState(pad, bindings = PROFILES.standard, options = {}) {
  const button = name => { const b = pad?.buttons?.[bindings[name]]; return !!b && (b.pressed || b.value > 0.5); };
  const axis = name => deadzone(pad?.axes?.[bindings[name]] ?? 0, options.deadzone ?? 0.19);
  return { moveX: axis('moveX'), moveY: axis('moveY'), lookX: axis('lookX'), lookY: axis('lookY') * (options.invertY ? -1 : 1),
    teleport:button('teleport'),fire:button('fire'),aim:button('aim'),reload:button('reload'),switch:button('switch'),jump:button('jump'),pause:button('pause'),
    confirm: !!pad?.buttons?.[0]?.pressed, up:!!pad?.buttons?.[12]?.pressed, down:!!pad?.buttons?.[13]?.pressed,
    left:!!pad?.buttons?.[14]?.pressed,right:!!pad?.buttons?.[15]?.pressed };
}
export class Input {
  constructor(canvas, options = {}) {
    this.canvas=canvas;this.keys=new Set();this.mouse={x:0,y:0,fire:false,aim:false};
    this.touch={moveX:0,moveY:0,lookX:0,lookY:0,teleport:false,fire:false,aim:false,reload:false,switch:false,jump:false};
    this.bindings={...PROFILES.standard,...options.bindings};this.deadzone=options.deadzone??.19;
    this.leftHanded=options.leftHanded??false;this.sensitivity=options.sensitivity??1;this.invertY=options.invertY??false;this.previous={};this.pad=null;this.active=false;
    window.addEventListener('keydown',e=>{
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
      this.keys.add(e.code);if(this.active && ['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>this.clear());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
    document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){this.mouse.x+=e.movementX;this.mouse.y+=e.movementY;}});
    canvas.addEventListener('mousedown',e=>{if(document.pointerLockElement===canvas){if(e.button===0)this.mouse.fire=true;if(e.button===2)this.mouse.aim=true;}});
    window.addEventListener('mouseup',e=>{if(e.button===0)this.mouse.fire=false;if(e.button===2)this.mouse.aim=false;});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    this.episodeTouch=new EpisodeTouch(this,document.getElementById('touch-controls'));guardGameGestures(()=>this.active);
  }
  clear(){this.episodeTouch?.clear();this.keys.clear();this.mouse={x:0,y:0,fire:false,aim:false};for(const k in this.touch)this.touch[k]=typeof this.touch[k]==='boolean'?false:0;}
  sample(){
    let pads=[];try{pads=Array.from(navigator.getGamepads?.()||[]).filter(p=>p?.connected);}catch(error){if(!this.padPermissionReported){this.padPermissionReported=true;this.onError?.(error);}}
    this.disconnected=!!this.pad&&!pads.some(p=>p.index===this.pad.index);
    this.pad=pads.find(p=>p.buttons.some(b=>b.pressed))||pads.find(p=>p.index===this.pad?.index)||pads[0]||null;
    const p=gamepadState(this.pad,this.bindings,this),k=this.keys,t=this.touch,gesture=this.episodeTouch.sample();
    const s={touchMovement:!!(t.moveX||t.moveY),moveX:p.moveX+(k.has('KeyD')||k.has('ArrowRight')?1:0)-(k.has('KeyA')||k.has('ArrowLeft')?1:0)+t.moveX,
      moveY:p.moveY+(k.has('KeyS')||k.has('ArrowDown')?1:0)-(k.has('KeyW')||k.has('ArrowUp')?1:0)+t.moveY,
      lookX:(p.lookX+t.lookX)*this.sensitivity,lookY:(p.lookY+t.lookY*(this.invertY?-1:1))*this.sensitivity,
      touchYaw:gesture.x*.5*Math.PI/180*this.sensitivity,touchPitch:gesture.y*.2*Math.PI/180*this.sensitivity*(this.invertY?-1:1),
      mouseX:this.mouse.x*this.sensitivity,mouseY:this.mouse.y*this.sensitivity*(this.invertY?-1:1),
      fire:p.fire||this.mouse.fire||k.has('ControlLeft')||t.fire,aim:p.aim||this.mouse.aim||k.has('AltLeft')||t.aim||gesture.aim,
      teleport:p.teleport||k.has('KeyT')||t.teleport,reload:p.reload||k.has('KeyR')||t.reload,switch:p.switch||k.has('KeyQ')||t.switch,
      jump:p.jump||k.has('Space')||t.jump,pause:p.pause||k.has('Escape')||k.has('KeyP'),confirm:p.confirm||k.has('Enter'),up:p.up,down:p.down,left:p.left,right:p.right};
    const n=Math.max(1,Math.hypot(s.moveX,s.moveY));s.moveX/=n;s.moveY/=n;
    s.pressed={};for(const key of ['teleport','reload','switch','jump','pause','confirm','up','down','left','right'])s.pressed[key]=s[key]&&!this.previous[key];
    for(const action of gesture.pulses)s.pressed[action]=true;
    this.previous=s;this.mouse.x=this.mouse.y=0;return s;
  }
  rumble(){try{this.pad?.vibrationActuator?.playEffect('dual-rumble',{duration:65,strongMagnitude:.15,weakMagnitude:.3})?.catch(()=>{});}catch{/* optional hardware feature */}}
}
