const actions={KeyJ:'pass',KeyK:'through',KeyL:'cross',Space:'shot'};
export class Input {
  constructor(){this.keys=new Set();this.pressed=new Set();this.charge=null;this.release=null;this.enabled=false;this.firstPerson=false;this.yaw=Math.PI/2;this.pitch=-.18;
    addEventListener('keydown',e=>{if(!this.enabled)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();if(!this.keys.has(e.code))this.pressed.add(e.code);this.keys.add(e.code);if(actions[e.code]&&!this.charge)this.charge={code:e.code,type:actions[e.code],time:0};});
    addEventListener('keyup',e=>{this.keys.delete(e.code);if(this.charge?.code===e.code){this.release={...this.charge};this.charge=null;}});
    addEventListener('blur',()=>this.clear());
    addEventListener('mousemove',e=>{if(this.enabled&&this.firstPerson&&document.pointerLockElement){this.yaw-=e.movementX*.0025;this.pitch=Math.max(-1.25,Math.min(.65,this.pitch-e.movementY*.002));}});
  }
  update(dt){if(this.charge)this.charge.time=Math.min(1.2,this.charge.time+dt);if(this.firstPerson)this.yaw+=(Number(this.keys.has('ArrowLeft'))-Number(this.keys.has('ArrowRight')))*dt*2;}
  clear(){this.keys.clear();this.pressed.clear();this.charge=null;this.release=null;}
  take(code){const yes=this.pressed.has(code);this.pressed.delete(code);return yes;}
  direction(){const x=Number(this.keys.has('KeyD')||(!this.firstPerson&&this.keys.has('ArrowRight')))-Number(this.keys.has('KeyA')||(!this.firstPerson&&this.keys.has('ArrowLeft'))),z=Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'));return this.firstPerson?{x:-Math.cos(this.yaw)*x-Math.sin(this.yaw)*z,z:Math.sin(this.yaw)*x-Math.cos(this.yaw)*z}:{x,z};}
  get sprint(){return this.keys.has('ShiftLeft')||this.keys.has('ShiftRight');}
  get curve(){return Number(this.keys.has('KeyQ'))-Number(this.keys.has('KeyE'));}
}
