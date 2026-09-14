import { Vector3 } from 'three';
import { BALL, PITCH, clamp } from './config.js';

/** SI units. Fixed 120 Hz integration, continuous swept contacts and finite ball radius. */
export class BallPhysics {
  constructor(){ this.position=new Vector3(0,BALL.radius,0);this.previous=this.position.clone();this.velocity=new Vector3();this.spin=new Vector3();this.lastTouch=0;this.wet=false;this.onGoal=()=>{};this.onOut=()=>{};this.sleeping=false;this.force=new Vector3();this.homing=null; }
  reset(x=0,z=0){this.position.set(x,BALL.radius,z);this.previous.copy(this.position);this.velocity.set(0,0,0);this.spin.set(0,0,0);this.homing=null;}
  kick(direction,power,lift=0,curve=0,team=0){
    const d=direction.clone().setY(0).normalize();
    this.velocity.copy(d).multiplyScalar(power); this.velocity.y=lift;
    this.spin.set(-d.z*power/BALL.radius*.18,curve*45,d.x*power/BALL.radius*.18);this.lastTouch=team;this.homing=null;
  }
  step(dt){
    this.previous.copy(this.position);
    const speed=this.velocity.length();
    // Playstyle homing: steer velocity toward a target so the ball bends on its own.
    if(this.homing){
      this.homing.life-=dt;
      if(this.homing.life<=0)this.homing=null;
      else{
        const to=this.homing.target.clone().sub(this.position);
        if(to.lengthSq()>.01){
          const desired=to.normalize().multiplyScalar(Math.max(speed,6));
          this.velocity.lerp(desired,1-Math.exp(-dt*this.homing.strength));
        }
      }
    }
    // F_drag = -0.5 rho Cd A |v| v; F_Magnus = coefficient (omega × v).
    this.force.copy(this.velocity).multiplyScalar(-.5*BALL.airDensity*BALL.drag*Math.PI*BALL.radius**2*speed/BALL.mass);
    this.force.add(new Vector3().crossVectors(this.spin,this.velocity).multiplyScalar(BALL.magnus/BALL.mass));
    this.force.y-=BALL.gravity;
    this.velocity.addScaledVector(this.force,dt);this.position.addScaledVector(this.velocity,dt);
    this.spin.multiplyScalar(Math.exp(-.32*dt));
    if(this.position.y<=BALL.radius){
      this.position.y=BALL.radius;
      if(this.velocity.y < -.65)this.velocity.y=-this.velocity.y*(this.wet?.46:.66);else this.velocity.y=0;
      const horizontal=Math.hypot(this.velocity.x,this.velocity.z);
      const friction=(this.wet?.55:.90)*dt;
      if(horizontal>0){const scale=Math.max(0,horizontal-friction)/horizontal;this.velocity.x*=scale;this.velocity.z*=scale;}
      this.spin.y*=Math.exp(-1.0*dt);
    }
    // Crossbars and posts use closest-point sweep, preventing fast shots tunnelling.
    for(const sign of [-1,1]){
      const x=sign*PITCH.length/2;
      for(const z of [-PITCH.goalWidth/2,PITCH.goalWidth/2])this.collidePost(new Vector3(x,clamp(this.position.y,0,PITCH.goalHeight),z),.065);
      if(Math.abs(this.position.z)<PITCH.goalWidth/2+.1)this.collidePost(new Vector3(x,PITCH.goalHeight,clamp(this.position.z,-PITCH.goalWidth/2,PITCH.goalWidth/2)),.065);
      const plane=sign*(PITCH.length/2+BALL.radius);
      if(sign*this.previous.x<sign*plane && sign*this.position.x>=sign*plane){
        const t=(plane-this.previous.x)/(this.position.x-this.previous.x);
        const y=this.previous.y+(this.position.y-this.previous.y)*t;
        const z=this.previous.z+(this.position.z-this.previous.z)*t;
        if(Math.abs(z)<PITCH.goalWidth/2-BALL.radius && y<PITCH.goalHeight-BALL.radius){this.onGoal(sign>0?0:1);return;}
      }
    }
    if(Math.abs(this.position.z)>PITCH.width/2+BALL.radius || Math.abs(this.position.x)>PITCH.length/2+.8 || this.position.y>40)this.onOut();
  }
  collidePost(point,radius){
    const segment=this.position.clone().sub(this.previous),length=segment.lengthSq();
    const t=length?clamp(point.clone().sub(this.previous).dot(segment)/length,0,1):0;
    const closest=this.previous.clone().addScaledVector(segment,t), normal=closest.sub(point),r=BALL.radius+radius;
    if(normal.lengthSq()<r*r){
      if(normal.lengthSq()<.00001)normal.copy(this.velocity).negate();normal.normalize();
      this.position.copy(point).addScaledVector(normal,r+.001);
      const inward=this.velocity.dot(normal);if(inward<0)this.velocity.addScaledVector(normal,-1.72*inward);
    }
  }
  /** Swept sphere against animated boot; contact required to impart an impulse. */
  bootContact(from,to,radius=.21){
    const relativeStart=from.clone().sub(this.previous),relativeEnd=to.clone().sub(this.position);
    const delta=relativeEnd.sub(relativeStart),denom=delta.lengthSq();
    const t=denom?clamp(-relativeStart.dot(delta)/denom,0,1):0;
    return relativeStart.addScaledVector(delta,t).lengthSq()<=(BALL.radius+radius)**2;
  }
}
