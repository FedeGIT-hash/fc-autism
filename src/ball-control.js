import { Vector3 } from 'three';
import { BALL, clamp } from './config.js';

const UP=new Vector3(0,1,0);

/** Close control remains a world-space ball: opponents can interrupt every touch. */
export class BallControl {
  constructor(match){this.match=match;this.owner=null;this.skill=null;this.lock=0;this.held=0;this.target=new Vector3();this.lastTarget=new Vector3();this.hasTarget=false;}
  reset(){if(this.owner)this.owner.hasBall=false;this.owner=null;this.skill=null;this.lock=0;this.held=0;this.hasTarget=false;}
  release(lock=.32){if(this.owner)this.owner.hasBall=false;this.owner=null;this.skill=null;this.lock=lock;this.held=0;this.hasTarget=false;}
  claim(player){if(this.owner===player)return;if(this.owner)this.owner.hasBall=false;this.owner=player;player.hasBall=true;this.held=0;this.hasTarget=false;this.match.ball.lastTouch=player.team;}
  startSkill(player,type){
    if(this.owner!==player||this.skill||player.skillCooldown>0||player.slide>0||player.pending||player.stamina<.16)return false;
    player.stamina-=type==='sombrero'?.12:.09;player.skillCooldown=1.0;player.skillType=type;player.skillTime=type==='sombrero'?.65:.58;
    if(type==='sombrero'){
      this.match.ball.kick(player.facing,5.2+player.velocity.length()*.45,6.5,0,player.team);
      this.release(.48);player.controlLock=.55;
      player.velocity.addScaledVector(player.facing,2.2);
      this.match.onMessage('SOMBRERITO',.8);
    }else{
      this.skill={type,time:0,duration:.58,forward:player.facing.clone(),right:new Vector3(player.facing.z,0,-player.facing.x)};
      player.velocity.addScaledVector(player.facing,1.6);
      this.match.onMessage('ELÁSTICA',.8);
    }
    this.match.audio.tone(type==='sombrero'?240:160,.08);return true;
  }
  /** A tackle must reach the ball, face it, and meet a low ball. No forced steals at distance. */
  tryTackle(player){
    const ball=this.match.ball,owner=this.owner;
    if(!owner||owner.team===player.team||player.tackle<=0||player.tackleConnected||ball.position.y>(player.slide>0?.68:.58))return false;
    const toBall=ball.position.clone().sub(player.position).setY(0),distance=toBall.length();
    const reach=player.slide>0?1.28:1.02;
    if(distance>reach||toBall.normalize().dot(player.facing)<.1)return false;
    // A body between boot and ball shields possession; tackle from the exposed side.
    const relative=owner.position.clone().sub(player.position).setY(0),along=relative.dot(toBall);
    if(along>0&&along<distance-.12&&relative.clone().addScaledVector(toBall,-along).length()<.34)return false;
    owner.controlLock=.8;owner.skillTime=0;owner.skillType=null;player.tackleConnected=true;
    this.release(player.slide>0?.24:0);
    if(player.slide>0)ball.kick(player.facing,6.7,.35,0,player.team);
    else{this.claim(player);ball.velocity.copy(player.velocity);ball.velocity.y=0;}
    this.match.effects.burst(ball.position,12);this.match.onMessage(player.team===0?'¡BALÓN RECUPERADO!':'ROBO DEL RIVAL',.8);return true;
  }
  update(dt){
    const {ball,players}=this.match;this.lock=Math.max(0,this.lock-dt);
    for(const player of players)if(this.tryTackle(player))break;
    if(this.owner){
      const p=this.owner;this.held+=dt;
      if(p.slide>0||ball.position.y>.85||ball.position.distanceTo(p.position)>2.1){this.release(.12);return;}
      // A spring with velocity feed-forward holds the ball at the leading boot.
      // Sprint gives a longer touch, leaving more room for an opponent's tackle.
      const speed=p.velocity.length(),right=new Vector3(p.facing.z,0,-p.facing.x);
      const reach=.62+clamp((speed-4)/5,0,1)*.23;
      this.target.copy(p.position).addScaledVector(p.facing,reach).addScaledVector(right,.1);
      if(this.skill){const s=this.skill;s.time+=dt;const t=clamp(s.time/s.duration,0,1);
        // Outside touch then a sharp inside cut: continuous position and finite velocity.
        const side=t<.38?.54*Math.sin(t/.38*Math.PI/2):.54-.99*(.5-.5*Math.cos((t-.38)/.62*Math.PI));
        const advance=.66+t*.25;
        this.target.copy(p.position).addScaledVector(s.forward,advance).addScaledVector(s.right,side);
        if(t>.35&&t<.85){p.velocity.addScaledVector(s.forward,3.5*dt);}
        if(t>=1){p.facing.copy(s.forward).applyAxisAngle(UP,-.24);this.skill=null;}
      }
      this.target.y=BALL.radius;
      const feed=this.hasTarget?this.target.clone().sub(this.lastTarget).divideScalar(dt):p.velocity.clone();feed.clampLength(0,14);
      this.lastTarget.copy(this.target);this.hasTarget=true;
      const desired=this.target.clone().sub(ball.position).multiplyScalar(28).add(feed);desired.y=0;desired.clampLength(0,21);
      ball.velocity.x+=(desired.x-ball.velocity.x)*(1-Math.exp(-dt*36));ball.velocity.z+=(desired.z-ball.velocity.z)*(1-Math.exp(-dt*36));
      ball.spin.y*=Math.exp(-dt*8);ball.lastTouch=p.team;
      return;
    }
    if(this.lock>0||ball.position.y>.58||ball.velocity.y>2.4)return;
    const candidates=players.filter(p=>p.controlLock<=0&&p.slide<=0&&!p.pending&&p.position.distanceTo(ball.position)<1.02&&ball.velocity.clone().sub(p.velocity).length()<13);
    candidates.sort((a,b)=>a.position.distanceToSquared(ball.position)-b.position.distanceToSquared(ball.position));
    for(const p of candidates){const d=ball.position.clone().sub(p.position).setY(0).normalize();if(d.dot(p.facing)>-.25){this.claim(p);break;}}
  }
}
