import { Vector3 } from 'three';

export class GameCamera {
  constructor(camera,input){this.camera=camera;this.input=input;this.mode='broadcast';this.previousPlayer=null;}
  setMode(mode,player){this.mode=mode;this.input.firstPerson=mode==='first';if(player){this.input.yaw=Math.atan2(player.facing.x,player.facing.z);this.input.pitch=-.48;}if(mode!=='first'&&typeof document!=='undefined'&&document.pointerLockElement)document.exitPointerLock();this.camera.fov=mode==='first'?82:46;this.camera.updateProjectionMatrix();}
  update(match,dt){
    for(const p of match.players){p.head.visible=true;p.torso.visible=true;p.mesh.visible=true;}
    const p=match.active;if(this.mode!=='first'||!p)return false;
    if(this.previousPlayer&&this.previousPlayer!==p){this.input.yaw=Math.atan2(p.facing.x,p.facing.z);}this.previousPlayer=p;
    p.head.visible=false;p.torso.visible=false;
    const yaw=this.input.yaw,pitch=this.input.pitch,speed=p.velocity.length(),bob=Math.sin(p.runPhase*2)*Math.min(speed/8,1)*.018;
    this.camera.position.copy(p.position).add(new Vector3(Math.sin(yaw)*.09,1.56+bob+(p.slide>0?-.65:0),Math.cos(yaw)*.09));
    const forward=new Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));this.camera.lookAt(this.camera.position.clone().add(forward));return true;
  }
}
