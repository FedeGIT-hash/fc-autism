import { controls, KICK_ACTIONS, actionForCode } from './controls.js';

export class Input {
  constructor(){this.keys=new Set();this.pressed=new Set();this.charge=null;this.release=null;this.enabled=false;this.firstPerson=false;this.yaw=Math.PI/2;this.pitch=-.18;
    addEventListener('keydown',e=>{if(!this.enabled)return;if(actionForCode(e.code)||['Tab'].includes(e.code))e.preventDefault();if(!this.keys.has(e.code))this.pressed.add(e.code);this.keys.add(e.code);const action=actionForCode(e.code);if(action&&KICK_ACTIONS.has(action)&&!this.charge)this.charge={code:e.code,type:action,time:0};});
    addEventListener('keyup',e=>{this.keys.delete(e.code);if(this.charge?.code===e.code){this.release={...this.charge};this.charge=null;}});
    addEventListener('blur',()=>this.clear());
    addEventListener('mousemove',e=>{if(this.enabled&&this.firstPerson&&document.pointerLockElement){this.yaw-=e.movementX*.0025;this.pitch=Math.max(-1.25,Math.min(.65,this.pitch-e.movementY*.002));}});
  }
  update(dt){if(this.charge)this.charge.time=Math.min(1.2,this.charge.time+dt);if(this.firstPerson)this.yaw+=(Number(this.keys.has('ArrowLeft'))-Number(this.keys.has('ArrowRight')))*dt*2;}
  clear(){this.keys.clear();this.pressed.clear();this.charge=null;this.release=null;}
  // Devuelve true una sola vez por pulsación (disparo por flanco) de cualquiera de las teclas de la acción.
  take(action){for(const code of (controls[action]||[])){if(this.pressed.has(code)){this.pressed.delete(code);return true;}}return false;}
  // Devuelve true mientras cualquiera de las teclas de la acción esté mantenida.
  held(action,{excludeArrows=false}={}){for(const code of (controls[action]||[])){if(excludeArrows&&code.startsWith('Arrow'))continue;if(this.keys.has(code))return true;}return false;}
  direction(){const opt=this.firstPerson?{excludeArrows:true}:undefined;const x=this.held('moveRight',opt)-this.held('moveLeft',opt),z=this.held('moveDown',opt)-this.held('moveUp',opt);return this.firstPerson?{x:-Math.cos(this.yaw)*x-Math.sin(this.yaw)*z,z:Math.sin(this.yaw)*x-Math.cos(this.yaw)*z}:{x,z};}
  get sprint(){return this.held('sprint');}
  get curve(){return Number(this.held('curveLeft'))-Number(this.held('curveRight'));}
}
