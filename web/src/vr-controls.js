// Independent dwell state makes gaze controls testable without headset hardware.
export class GazeDwell{
 constructor(){this.target=null;this.time=0;this.latched=false;}
 update(target,dt,delay=1){if(target!==this.target){this.target=target;this.time=0;this.latched=false;}if(!target)return false;this.time+=dt;if(!this.latched&&this.time>=delay){this.latched=true;return true;}return false;}
 reset(){this.target=null;this.time=0;this.latched=false;}
}
