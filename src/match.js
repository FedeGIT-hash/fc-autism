import * as T from 'three';
import { Player } from './player.js';
import { BallPhysics } from './physics.js';
import { BallControl } from './ball-control.js';
import { FootballAI } from './ai.js';
import { BALL, TEAMS, clamp } from './config.js';
import { PlaystyleManager } from './playstyle.js';

export class Match {
  constructor(scene,input,effects,audio){this.scene=scene;this.input=input;this.effects=effects;this.audio=audio;this.players=[];this.ball=new BallPhysics();this.ball.onGoal=team=>this.goal(team);this.ball.onOut=()=>this.restartFromOut();this.score=[0,0];this.elapsed=0;this.running=false;this.freeze=0;this.practice=false;this.duration=360;this.active=null;this.onMessage=()=>{};this.onEnd=()=>{};this.onHalf=()=>{};this.halfDone=false;
    this.isMultiplayer=false;this.isHost=true;this.multiplayer=null;this.localId=null;this.remote=new Map();this.syncCounter=0;this.inputSyncElapsed=0;
    this.control=new BallControl(this);this.ai=new FootballAI(this);this.playstyle=new PlaystyleManager(scene,this);
    const tex=this.ballTexture();this.ballMesh=new T.Mesh(new T.SphereGeometry(BALL.radius,24,16),new T.MeshStandardMaterial({map:tex,roughness:.55}));this.ballMesh.castShadow=true;scene.add(this.ballMesh);
    this.marker=new T.Mesh(new T.RingGeometry(.49,.56,40),new T.MeshBasicMaterial({color:0xdaff78,side:T.DoubleSide}));this.marker.rotation.x=-Math.PI/2;scene.add(this.marker);
    this.guestMarker=new T.Mesh(new T.RingGeometry(.49,.56,40),new T.MeshBasicMaterial({color:0x91c8ee,side:T.DoubleSide}));this.guestMarker.rotation.x=-Math.PI/2;this.guestMarker.visible=false;scene.add(this.guestMarker);
    this.ballShadow=new T.Mesh(new T.CircleGeometry(.25,20),new T.MeshBasicMaterial({color:0x14271b,transparent:true,opacity:.3,depthWrite:false}));this.ballShadow.rotation.x=-Math.PI/2;scene.add(this.ballShadow);
  }
  ballTexture(){const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');g.fillStyle='#f1eee1';g.fillRect(0,0,512,256);for(let y=0;y<5;y++)for(let x=0;x<9;x++){const xx=x*64+(y%2)*32,yy=y*62;g.beginPath();for(let k=0;k<5;k++){const a=k/5*Math.PI*2;g.lineTo(xx+Math.cos(a)*15,yy+Math.sin(a)*15);}g.closePath();g.fillStyle='#1d333b';g.fill();g.strokeStyle='#99a59d';g.lineWidth=1;g.beginPath();g.arc(xx,yy,30,0,Math.PI*2);g.stroke();}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
  setup(team=0,practice=false,duration=360){this.players.forEach(p=>p.dispose(this.scene));this.players=[];this.teamIndex=team;this.practice=practice;this.duration=duration;this.score=[0,0];this.elapsed=0;this.halfDone=false;this.freeze=0;this.teams=[TEAMS[team],TEAMS[(team+1)%TEAMS.length]];
    for(let t=0;t<2;t++)for(let i=0;i<5;i++){if(practice&&t===1&&i!==4)continue;this.players.push(new Player(this.scene,t,i,this.teams[t]));}this.resetPositions(0);this.running=false;this.syncVisuals(0);this.playstyle.reset();
  }
  setupMultiplayer(multiplayer,isHost,roster,localId,config={}){
    this.isMultiplayer=true;this.isHost=isHost;this.multiplayer=multiplayer;this.localId=localId;this.remote=new Map();this.syncCounter=0;this.inputSyncElapsed=0;
    this.setup(config.team||0,false,config.duration||360);
    const myEntry=roster.find(p=>p.id===localId);
    this.localTeam=myEntry?myEntry.side:0;this.localIndex=myEntry?myEntry.slot:0;
    for(const entry of roster){
      const player=this.players.find(p=>p.team===entry.side&&p.index===entry.slot);
      if(!player)continue;
      if(entry.id===localId){this.active=player;}
      else{player.remoteId=entry.id;this.remote.set(entry.id,player);}
    }
  }
  resetPositions(kickoff=0){this.control.reset();this.ai.reset();const formation=[[-.68,0],[-10,-11],[-11,10],[-19,0],[-28,0]];for(const p of this.players){const pos=formation[p.index],sign=p.team===0?1:-1;p.reset(pos[0]*sign,pos[1]);if(p.index===0&&p.team!==kickoff)p.position.x=-sign*5;}this.ball.reset();
    if(!this.isMultiplayer)this.active=this.players.find(p=>p.team===0&&p.index===0);
    this.input.clear();
  }
  goal(team){if(this.freeze>0)return;this.penalty=null;this.control.release();this.score[team]++;this.freeze=2.4;this.kickoff=1-team;this.ball.velocity.multiplyScalar(.1);this.onMessage(`¡GOOOL!\n${this.teams[team].name}`,2.4);this.audio.tone(700,.55);
    if(this.isMultiplayer&&this.isHost&&this.multiplayer)this.multiplayer.sendEvent({type:'goal',team,score:[...this.score]});
  }
  restartFromOut(){if(this.freeze>0)return;this.control.reset();const x=clamp(this.ball.position.x,-28,28),z=clamp(this.ball.position.z,-18,18),team=1-this.ball.lastTouch;this.ball.reset(x,z);const candidates=this.players.filter(p=>p.team===team&&!p.keeper);const p=candidates.sort((a,b)=>a.position.distanceToSquared(this.ball.position)-b.position.distanceToSquared(this.ball.position))[0];if(p){p.position.set(x+(team===0?-.7:.7),0,z);p.facing.set(team===0?1:-1,0,0);p.cooldown=.5;}this.onMessage('BALÓN FUERA · SAQUE',1.3);}
  isPenaltyFoul(owner,tackler){const defender=tackler.team,goalSign=defender===0?-1:1;return owner.team!==defender&&owner.position.x*goalSign>18&&Math.abs(owner.position.z)<9;}
  awardPenalty(team){
    if(this.penalty)return;const defender=1-team,goalSign=team===0?1:-1;
    const kicker=this.players.filter(p=>p.team===team&&!p.keeper).sort((a,b)=>a.position.distanceToSquared(new T.Vector3(goalSign*19,0,0))-b.position.distanceToSquared(new T.Vector3(goalSign*19,0,0)))[0];
    const keeper=this.players.find(p=>p.team===defender&&p.keeper);if(!kicker||!keeper)return;
    this.control.reset();this.ball.reset(goalSign*19,0);kicker.position.set(goalSign*18.25,0,0);kicker.facing.set(goalSign,0,0);keeper.position.set(goalSign*29.2,0,0);keeper.facing.set(-goalSign,0,0);
    for(const p of this.players)if(p!==kicker&&p!==keeper){p.velocity.set(0,0,0);p.position.x=clamp(p.position.x,-14,14);p.position.z=clamp(p.position.z,-14,14);}
    this.penalty={team,defender,kicker,keeper,goalSign,timer:2.2,kicked:false,shotTime:0};this.onMessage('¡PENAL!\nATACA Y DISPARA · DEFENSOR MUEVE AL PORTERO',2.2);this.audio.tone(520,.25);
  }
  stepPenalty(dt){
    const p=this.penalty;if(!p)return;this.input.update(dt);p.timer-=dt;
    let keeperMove=0,kick=null,aim=0;
    if(this.active?.team===p.defender){const d=this.input.direction();keeperMove=d.x||d.z||0;}
    if(this.active?.team===p.team&&this.input.release){kick=this.input.release;this.input.release=null;aim=this.input.direction().z||0;}
    if(this.multiplayer){for(const [id,remote] of this.remote){const r=this.multiplayer.remoteInputs.get(id);if(!r)continue;if(remote.team===p.defender)keeperMove=r.x||r.z||keeperMove;if(remote.team===p.team&&r.kick){kick=r.kick;aim=r.z||0;r.kick=null;}}}
    p.keeper.position.z=clamp(p.keeper.position.z+keeperMove*dt*7,-3.2,3.2);p.keeper.velocity.set(0,0,keeperMove*7);p.keeper.animate(dt);p.kicker.animate(dt);
    if(!p.kicked&&p.timer<=0&&kick?.type==='shot'){const targetZ=clamp(aim*3.1,-3.4,3.4);const direction=new T.Vector3(p.goalSign*31-p.kicker.position.x,0,targetZ-p.kicker.position.z);this.control.release(.7);this.ball.kick(direction,25,1.7,0,p.team);p.kicked=true;}
    if(p.kicked){p.shotTime+=dt;this.ball.step(dt);const d=this.ball.position.clone().sub(p.keeper.position).setY(0);if(d.length()<.9&&this.ball.position.y<1.7){this.ball.kick(d.normalize(),12,.7,0,p.defender);this.onMessage('¡ATAJADA!',1);p.kicked=false;p.timer=-5;}
      if(p.shotTime>4){this.penalty=null;this.resetPositions(1-p.team);}}
    else if(p.timer<-6){this.penalty=null;this.resetPositions(1-p.team);}
  }
  switchPlayer(team=null){
    const targetTeam=team!==null?team:(this.active?.team??0);
    const current=this.active;
    const owner=this.control.owner;
    const sorted=this.players.filter(p=>p.team===targetTeam&&p!==current&&!p.keeper&&(!p.remoteId||p.remoteId===current?.remoteId)).sort((a,b)=>{
      // If a teammate controls the ball, make that player the first option.
      if(a===owner)return -1;if(b===owner)return 1;
      return a.position.distanceToSquared(this.ball.position)-b.position.distanceToSquared(this.ball.position);
    });
    if(sorted[0])this.active=sorted[0];
  }
  switchRemotePlayer(id){
    const current=this.remote.get(id);if(!current)return null;
    const sorted=this.players.filter(p=>p.team===current.team&&p!==current&&!p.keeper&&!p.remoteId).sort((a,b)=>a.position.distanceToSquared(this.ball.position)-b.position.distanceToSquared(this.ball.position));
    const next=sorted[0];if(!next)return null;
    current.remoteId=null;next.remoteId=id;this.remote.set(id,next);return next;
  }
  requestKick(p,type,charge=0,curve=0,receiver=null){if(p.cooldown>0||p.skillTime>0||p.slide>0)return;const amount=clamp(charge/1.2,0,1);
    const ps=p.playstyle;if(ps){if(type==='shot'&&ps.type==='bombeado'){this.requestBombeado(p,amount);return;}if((type==='pass'||type==='through')&&ps.type==='balistico'){this.requestBalistico(p);return;}}
    let dir=p.facing.clone();
    if(type==='pass'||type==='through'){const mates=this.players.filter(a=>a.team===p.team&&a!==p&&!a.keeper).map(a=>({p:a,d:a.position.clone().sub(p.position)})).filter(a=>a.d.clone().normalize().dot(dir)>-.1).sort((a,b)=>(a.d.length()*(1.3-a.d.clone().normalize().dot(dir)))-(b.d.length()*(1.3-b.d.clone().normalize().dot(dir))));if(mates[0]){dir.copy(mates[0].d);if(type==='through')dir.addScaledVector(mates[0].p.velocity,1.3).add(new T.Vector3(p.team===0?4:-4,0,0));dir.normalize();}}
    if(receiver)dir.copy(receiver.position).addScaledVector(receiver.velocity,.3).sub(p.position).setY(0).normalize();
    if(type==='shot'){// Greater power and movement introduce a small, explicit accuracy tradeoff.
      const error=(Math.random()-.5)*(.02+amount*.09+(1-p.stamina)*.1);dir.applyAxisAngle(new T.Vector3(0,1,0),error);}
    const spec={pass:[7+amount*11,.12],through:[12+amount*12,.4],cross:[12+amount*10,7+amount*5],shot:[17+amount*16,1.8+amount*5]}[type];
    p.pending={dir,power:spec[0],lift:spec[1],curve,life:.3};p.kickTime=.24;p.cooldown=.38;
  }
  clearPlaystyle(p){p.playstyle=null;if(p.playstyleIcon)p.playstyleIcon.visible=false;}
  requestBombeado(p,amount){
    const goalX=p.team===0?30:-30;
    const success=Math.random()<.75;
    const targetZ=success?(Math.random()*2-1)*1.7:(Math.random()<.5?-4.7:4.7);
    const target=new T.Vector3(goalX,1.3,targetZ);
    const dir=target.clone().sub(p.position).setY(0).normalize();
    const curve=(Math.random()<.5?-1:1)*(.6+amount*.4);
    p.pending={dir,power:26+amount*6,lift:9+amount*4,curve,life:.35,homing:{target,strength:5,life:2.6}};
    p.kickTime=.24;p.cooldown=.38;this.clearPlaystyle(p);
    this.onMessage('¡TIRO BOMBEADO!',1.5);this.audio.tone(340,.12);
  }
  requestBalistico(p){
    const mates=this.players.filter(a=>a.team===p.team&&a!==p&&!a.keeper);
    if(!mates.length){this.clearPlaystyle(p);return;}
    const far=mates.reduce((a,b)=>a.position.distanceToSquared(p.position)>b.position.distanceToSquared(p.position)?a:b);
    const dir=far.position.clone().sub(p.position).setY(0).normalize();
    const dist=clamp(p.position.distanceTo(far.position),4,40);
    const target=far.position.clone();target.y=1;
    p.pending={dir,power:clamp(14+dist*.35,14,30),lift:6+dist*.1,curve:0,life:.35,homing:{target,track:far,strength:3.2,life:2.8}};
    p.kickTime=.24;p.cooldown=.38;this.clearPlaystyle(p);
    this.onMessage('¡PASE BALÍSTICO!',1.5);this.audio.tone(340,.12);
  }
  step(dt){if(!this.running)return;if(this.freeze>0){this.freeze-=dt;if(this.freeze<=0)this.resetPositions(this.kickoff);return;}this.elapsed+=dt;
    if(!this.practice&&!this.halfDone&&this.elapsed>=this.duration/2){this.halfDone=true;this.resetPositions(1);this.onHalf();return;}
    if(!this.practice&&this.elapsed>=this.duration){this.running=false;this.onEnd();return;}
    if(!this.isMultiplayer||this.isHost)this.playstyle.update(dt);

    // Multiplayer Guest (!isHost) branch
    if(this.isMultiplayer&&!this.isHost){
      this.input.update(dt);
      const switchPlayer=this.input.take('switchPlayer');
      if(switchPlayer)this.switchPlayer();
      const skillR=this.input.take('skillSombrero'),skillF=this.input.take('skillElastica'),skillG=this.input.take('skillBicicleta'),skillI=this.input.takeInsideCut?.()||false;
      const tackleV=this.input.take('tackle'),tackleX=this.input.take('slideTackle');
      const move=this.input.direction();
      let kickPayload=null;
      if(this.input.release){
        kickPayload={...this.input.release,curve:this.input.curve};
        this.input.release=null;
      }
      // Realtime is for short state messages, not a 120 Hz simulation feed.
      // Send movement at 20 Hz and send action edges immediately.
      this.inputSyncElapsed+=dt;
      const hasEvent=!!(kickPayload||skillR||skillF||skillG||skillI||tackleV||tackleX||switchPlayer);
      if(this.multiplayer&&(hasEvent||this.inputSyncElapsed>=.05)){
        this.multiplayer.sendInput({
          x:move.x,z:move.z,sprint:this.input.sprint,
          kick:kickPayload,
          skill:skillR?'sombrero':skillF?'elastica':skillG?'bicicleta':skillI?'recorte':null,
          tackle:tackleV,slideTackle:tackleX,switchPlayer
        });
        this.inputSyncElapsed=0;
      }
      if(this.active){
        const aim=new T.Vector3(move.x,0,move.z);
        if(tackleX)this.active.startTackle(true);
        if(tackleV)this.active.startTackle(false);
        this.active.move(aim,this.input.sprint,dt);
        this.active.animate(dt);
      }
      for(const p of this.players)if(p!==this.active)p.animate(dt);
      return;
    }

    if(this.penalty){this.stepPenalty(dt);return;}

    // Host & Single Player branch
    this.input.update(dt);
    // `switchPlayer` used to be shown in the controls but was never consumed,
    // leaving the player stuck with the same footballer for the whole match.
    if(this.input.take('switchPlayer'))this.switchPlayer();
    if(this.input.take('skillSombrero'))this.control.startSkill(this.active,'sombrero');
    if(this.input.take('skillElastica'))this.control.startSkill(this.active,'elastica');
    if(this.input.take('skillBicicleta'))this.control.startSkill(this.active,'bicicleta');
    if(this.input.takeInsideCut?.())this.control.startSkill(this.active,'recorte');

    if(this.isMultiplayer&&this.multiplayer){
      for(const [id,player] of this.remote){
        const r=this.multiplayer.remoteInputs.get(id);
        if(!r)continue;
        let controlled=player;
        if(r.switchPlayer){controlled=this.switchRemotePlayer(id)||player;r.switchPlayer=false;}
        if(r.skill){this.control.startSkill(controlled,r.skill);r.skill=null;}
        if(r.slideTackle){if(controlled.startTackle(true))this.effects.burst(controlled.position,22);r.slideTackle=false;}
        if(r.tackle){controlled.startTackle(false);r.tackle=false;}
        if(r.kick){this.requestKick(controlled,r.kick.type,r.kick.time,r.kick.curve);r.kick=null;}
      }
    }

    const movement=this.input.direction();const aim=new T.Vector3(movement.x,0,movement.z);this.ai.update(dt);
    for(const p of this.players){let dir=new T.Vector3(),sprint=false;
      if(p===this.active){
        dir.copy(aim);sprint=this.input.sprint;
        if(this.input.take('slideTackle')&&p.startTackle(true))this.effects.burst(p.position,22);
        if(this.input.take('tackle'))p.startTackle(false);
        if(p.slide>0)dir.copy(p.facing);
      }else if(p.remoteId&&this.multiplayer){
        const r=this.multiplayer.remoteInputs.get(p.remoteId);
        const fresh=r&&(!r.updatedAt||Date.now()-r.updatedAt<1200);
        if(fresh){dir.set(r.x||0,0,r.z||0);sprint=!!r.sprint;}
        else{const decision=this.ai.steer(p);dir.copy(decision.direction);sprint=decision.sprint;}
        if(p.slide>0)dir.copy(p.facing);
      }else{
        const decision=this.ai.steer(p);dir.copy(decision.direction);sprint=decision.sprint;
      }
      const view=p===this.active&&this.input.firstPerson?new T.Vector3(Math.sin(this.input.yaw),0,Math.cos(this.input.yaw)):null;
      p.move(dir,sprint,dt,view);
      if(p===this.active&&this.input.release){const a=this.input.release;this.input.release=null;this.requestKick(p,a.type,a.time,this.input.curve);}
      p.animate(dt);
    }
    // Resolve body separation before foot contacts, so players cannot pass through each other.
    for(let i=0;i<this.players.length;i++)for(let j=i+1;j<this.players.length;j++){const a=this.players[i],b=this.players[j],d=a.position.clone().sub(b.position),len=d.length();if(len<.58&&len>.001){d.multiplyScalar((.58-len)/len*.5);a.position.add(d);b.position.sub(d);}}
    if(this.ball.homing&&this.ball.homing.track){this.ball.homing.target.copy(this.ball.homing.track.position);this.ball.homing.target.y=1;}
    this.control.update(dt);
    this.ball.step(dt);
    if(this.freeze>0)return;
    for(const p of this.players){const d=this.ball.position.clone().sub(p.position);d.y=0;const distance=d.length();
      if(p.pending){p.pending.life-=dt;
        if(this.ball.bootContact(p.bootPrevious,p.bootCurrent,.24)){const k=p.pending;this.control.release(.35);p.controlLock=.5;this.ball.kick(k.dir,k.power,k.lift,k.curve,p.team);if(k.homing)this.ball.homing=k.homing;p.pending=null;this.effects.burst(this.ball.position,5);this.audio.tone(95,.07);}
        else if(p.pending.life<=0)p.pending=null;
      }
      if(distance<.57&&this.ball.position.y<.7){const normal=distance>.001?d.divideScalar(distance):p.facing.clone();this.ball.position.x=p.position.x+normal.x*.58;this.ball.position.z=p.position.z+normal.z*.58;const incoming=this.ball.velocity.clone().sub(p.velocity).dot(normal);if(incoming<0)this.ball.velocity.addScaledVector(normal,-incoming*1.35);this.ball.lastTouch=p.team;this.ball.homing=null;}
      // A sliding foot can also clear a loose ball once, after possession is released.
      if(!this.control.owner&&p.slide>0&&!p.tackleConnected&&distance<1.1&&this.ball.position.y<.5&&d.clone().normalize().dot(p.facing)>.1){this.ball.kick(p.facing,8,.5,0,p.team);p.tackleConnected=true;this.control.lock=.24;p.controlLock=.5;}
      if(p.velocity.length()>7&&Math.random()<dt*10)this.effects.burst(p.position.clone().setY(1.4),1,'sweat');
    }

    if(this.isMultiplayer&&this.isHost&&this.multiplayer){
      this.syncCounter++;
      if(this.syncCounter%6===0){
        this.multiplayer.sendSnapshot(this.getSnapshot());
      }
    }
  }
  getSnapshot(){
    return {
      t:Number(this.elapsed.toFixed(2)),s:[this.score[0],this.score[1]],f:Number(this.freeze.toFixed(2)),h:this.halfDone,
      b:{p:[Number(this.ball.position.x.toFixed(2)),Number(this.ball.position.y.toFixed(2)),Number(this.ball.position.z.toFixed(2))],v:[Number(this.ball.velocity.x.toFixed(2)),Number(this.ball.velocity.y.toFixed(2)),Number(this.ball.velocity.z.toFixed(2))],w:this.control.owner?[this.control.owner.team,this.control.owner.index]:null},
      p:this.players.map(p=>({t:p.team,i:p.index,x:Number(p.position.x.toFixed(2)),z:Number(p.position.z.toFixed(2)),fx:Number(p.facing.x.toFixed(2)),fz:Number(p.facing.z.toFixed(2)),vx:Number(p.velocity.x.toFixed(2)),vz:Number(p.velocity.z.toFixed(2)),st:Number(p.stamina.toFixed(2)),sl:Number(p.slide.toFixed(2)),kt:Number(p.kickTime.toFixed(2)),sk:p.skillTime>0?p.skillType:null}))
    };
  }
  applySnapshot(snap){
    if(!snap)return;
    this.score[0]=snap.s[0];this.score[1]=snap.s[1];this.elapsed=snap.t;this.freeze=snap.f;this.halfDone=snap.h;
    if(snap.b){
      const targetPos=new T.Vector3(snap.b.p[0],snap.b.p[1],snap.b.p[2]),targetVel=new T.Vector3(snap.b.v[0],snap.b.v[1],snap.b.v[2]);
      if(snap.b.w){const owner=this.players.find(p=>p.team===snap.b.w[0]&&p.index===snap.b.w[1]);if(owner&&this.control.owner!==owner)this.control.claim(owner);}
      else if(this.control.owner)this.control.release(0);
      this.ball.position.lerp(targetPos,.5);this.ball.velocity.lerp(targetVel,.5);
    }
    if(snap.p){
      for(const sp of snap.p){
        const p=this.players.find(pl=>pl.team===sp.t&&pl.index===sp.i);if(!p)continue;
        if(p===this.active){
          const targetP=new T.Vector3(sp.x,0,sp.z),dist=p.position.distanceTo(targetP);
          if(dist>1.4)p.position.copy(targetP);else if(dist>.2)p.position.lerp(targetP,.25);
          p.stamina=sp.st;
        }else{
          p.position.lerp(new T.Vector3(sp.x,0,sp.z),.5);p.facing.set(sp.fx,0,sp.fz);p.velocity.set(sp.vx,0,sp.vz);p.stamina=sp.st;p.slide=sp.sl;p.kickTime=sp.kt;p.skillType=sp.sk;p.skillTime=sp.sk?.3:0;
        }
      }
    }
  }
  syncVisuals(dt){this.ballMesh.position.copy(this.ball.position);const speed=this.ball.velocity.length();if(speed>.01){const axis=new T.Vector3(this.ball.velocity.z,0,-this.ball.velocity.x).normalize();this.ballMesh.rotateOnWorldAxis(axis,speed*dt/BALL.radius);}this.marker.visible=!!this.active;if(this.active)this.marker.position.set(this.active.position.x,.04,this.active.position.z);
    if(this.guestMarker)this.guestMarker.visible=false;
    this.ballShadow.position.set(this.ball.position.x,.028,this.ball.position.z);this.ballShadow.material.opacity=.35/(1+this.ball.position.y);this.ballShadow.scale.setScalar(1+this.ball.position.y*.15);
  }
  dispose(){if(this.guestMarker)this.scene.remove(this.guestMarker);this.players.forEach(p=>p.dispose(this.scene));}
}
