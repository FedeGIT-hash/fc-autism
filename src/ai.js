import { Vector3 } from 'three';
import { clamp } from './config.js';

// Decisions are sampled at 5 Hz and steering is integrated at the physics rate.
// One presser per team; other players cover lanes instead of chasing in a pack.
export class FootballAI {
  constructor(match){this.match=match;this.timer=0;this.plans=new Map();this.pressers=[null,null];}
  reset(){this.timer=0;this.plans.clear();this.pressers=[null,null];}
  laneClearance(from,to,opponents){const line=to.clone().sub(from),length=line.lengthSq();let clearance=10;for(const p of opponents){const t=clamp(p.position.clone().sub(from).dot(line)/(length||1),0,1);if(t<.08||t>.95)continue;clearance=Math.min(clearance,p.position.distanceTo(from.clone().addScaledVector(line,t)));}return clearance;}
  update(dt){this.timer-=dt;if(this.timer>0)return;this.timer=.2;
    const m=this.match,ball=m.ball,owner=m.control.owner;
    for(let team=0;team<2;team++){
      const allies=m.players.filter(p=>p.team===team),opponents=m.players.filter(p=>p.team!==team),sign=team===0?1:-1;
      const isHuman = p => p === m.active || (m.isMultiplayer && p === m.guestActive);
      const candidates=allies.filter(p=>!p.keeper&&!isHuman(p));
      const closest=candidates.sort((a,b)=>a.position.distanceToSquared(ball.position)-b.position.distanceToSquared(ball.position))[0];
      const old=this.pressers[team];this.pressers[team]=old&&!isHuman(old)&&closest&&old.position.distanceTo(ball.position)<closest.position.distanceTo(ball.position)+1.8?old:closest;
      for(const p of allies){if(isHuman(p))continue;const target=p.home.clone();let action=null,passTarget=null,sprint=false;
        if(owner===p){
          const pressure=Math.min(...opponents.map(o=>o.position.distanceTo(p.position))),goal=new Vector3(sign*30,0,0);
          const distance=Math.abs(goal.x-p.position.x);
          target.copy(goal);target.z=p.position.z*.55;
          // Offer a safe forward pass, accounting for the receiver and the passing lane.
          let best=-Infinity;
          for(const mate of allies){if(mate===p||mate.keeper)continue;const d=p.position.distanceTo(mate.position);if(d<3||d>27)continue;const lane=this.laneClearance(p.position,mate.position,opponents);const space=Math.min(...opponents.map(o=>o.position.distanceTo(mate.position)));const score=(mate.position.x-p.position.x)*sign*.28+Math.min(space,6)*.5+Math.min(lane,4)-d*.055;if(lane>1.1&&score>best){best=score;passTarget=mate;}}
          const facingGoal=goal.clone().sub(p.position).normalize();
          if(m.control.held>.65&&distance<17&&Math.abs(p.position.z)<12&&this.laneClearance(p.position,goal,opponents)>.8&&p.facing.dot(facingGoal)>.9)action='shot';
          else if(m.control.held>(p.keeper?.55:pressure<2.6?.6:2.1)&&passTarget&&best>1)action='pass';
          else if(pressure<2.3){const nearest=opponents.reduce((a,b)=>a.position.distanceTo(p.position)<b.position.distanceTo(p.position)?a:b);target.z=clamp(p.position.z+(p.position.z>=nearest.position.z?4:-4),-16,16);}
        }else if(p.keeper){
          target.set(-sign*28,0,clamp(ball.position.z*.43,-3.2,3.2));
          // Predict the interception on the keeper line for incoming shots.
          const t=(target.x-ball.position.x)/(ball.velocity.x||.001);
          if(t>0&&t<1.4){target.z=clamp(ball.position.z+ball.velocity.z*t,-3.35,3.35);sprint=true;}
          if(ball.position.distanceTo(p.position)<3.2&&ball.position.y<.65)target.copy(ball.position).setY(0);
        }else if(owner?.team===team){
          const lanes=[0,-11,11,0],forward=p.index===3?-8:5;
          target.set(clamp(owner.position.x+sign*forward,-25,25),0,lanes[p.index]);
          if(target.distanceTo(owner.position)<5)target.z=owner.position.z>0?-8:8;
        }else if(this.pressers[team]===p&&!(isHuman(p))){
          const humanPressing = (team === 0 ? m.active : (m.isMultiplayer ? m.guestActive : null));
          if (humanPressing && !owner && humanPressing.position.distanceTo(ball.position) < 3) {
            target.copy(p.home);
          } else {
            target.copy(ball.position).addScaledVector(ball.velocity,clamp(p.position.distanceTo(ball.position)/18,.08,.55)).setY(0);
          }
          sprint=p.position.distanceTo(target)>5&&p.stamina>.3;
          if(owner&&owner.team!==team&&p.position.distanceTo(ball.position)<1.1&&m.control.held>.35)action='tackle';
        }else{
          target.x=clamp(p.home.x+ball.position.x*.28,-25,25);target.z=p.home.z+ball.position.z*.2;
          const threats=opponents.filter(o=>!o.keeper&&o!==owner).sort((a,b)=>a.position.distanceToSquared(target)-b.position.distanceToSquared(target));
          if(owner&&threats[0])target.lerp(threats[0].position.clone().add(new Vector3(-sign*2,0,0)),.48);
        }
        target.x=clamp(target.x,-28.5,28.5);target.z=clamp(target.z,-17,17);
        this.plans.set(p,{target,action,passTarget,sprint});
      }
    }
  }
  steer(p){const plan=this.plans.get(p);if(!plan)return {direction:new Vector3(),sprint:false};const direction=plan.target.clone().sub(p.position).setY(0);const distance=direction.length();if(distance<.3)direction.set(0,0,0);else direction.normalize().multiplyScalar(Math.min(1,distance/1.3));
    // Soft local avoidance prevents teammates walking into one another.
    for(const other of this.match.players){if(other===p)continue;const offset=p.position.clone().sub(other.position).setY(0),d=offset.length();if(d>.01&&d<1.25)direction.addScaledVector(offset,(1.25-d)/d*.65);}
    direction.clampLength(0,1);
    if(plan.action==='tackle')p.startTackle(false);
    else if(plan.action&&this.match.control.owner===p&&!p.pending&&p.cooldown<=0){this.match.requestKick(p,plan.action,plan.action==='shot'?.45:.38,0,plan.passTarget);plan.action=null;}
    return {direction,sprint:plan.sprint};
  }
}
