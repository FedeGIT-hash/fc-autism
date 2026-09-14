import * as T from 'three';
import { clamp } from './config.js';

let fabric;
function cloth(){if(fabric)return fabric;const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#8080ff';ctx.fillRect(0,0,64,64);for(let y=0;y<64;y+=4)for(let x=0;x<64;x+=4){ctx.fillStyle='#a080ec';ctx.fillRect(x,y,2,1);ctx.fillStyle='#6080ee';ctx.fillRect(x+2,y+1,2,1);}fabric=new T.CanvasTexture(c);fabric.wrapS=fabric.wrapT=T.RepeatWrapping;fabric.repeat.set(4,4);return fabric;}
export class Player {
  constructor(scene,team,index,config){this.team=team;this.index=index;this.name=config.players[index];this.number=[10,7,8,4,1][index];this.keeper=index===4;this.position=new T.Vector3();this.velocity=new T.Vector3();this.facing=new T.Vector3(team===0?1:-1,0,0);this.stamina=1;this.cooldown=0;this.slide=0;this.kickTime=0;this.runPhase=0;this.pending=null;this.bootPrevious=new T.Vector3();this.bootCurrent=new T.Vector3();this.home=new T.Vector3();this.mesh=new T.Group();scene.add(this.mesh);
    const skin=new T.MeshStandardMaterial({color:[0xb98059,0x8c563f,0xd5a076,0x6f4635,0xae7a57][index],roughness:.87});this.shirt=new T.MeshStandardMaterial({color:this.keeper?0xf8b34c:config.color,roughness:.8,normalMap:cloth(),normalScale:new T.Vector2(.15,.15)});this.shorts=new T.MeshStandardMaterial({color:config.shorts,roughness:.9});const socks=new T.MeshStandardMaterial({color:config.color});const boot=new T.MeshStandardMaterial({color:index%2?0xe8e6d7:0x26323a,roughness:.65});
    const add=(g,geo,mat,x,y,z)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
    this.body=new T.Group();this.mesh.add(this.body);this.torso=add(this.body,new T.CylinderGeometry(.27,.22,.55,8),this.shirt,0,1.13,0);this.head=new T.Group();this.body.add(this.head);add(this.head,new T.SphereGeometry(.17,12,10),skin,0,1.65,0);add(this.head,new T.SphereGeometry(.175,10,8,0,Math.PI*2,0,Math.PI*.48),new T.MeshStandardMaterial({color:0x282522}),0,1.68,0);add(this.body,new T.BoxGeometry(.43,.23,.28),this.shorts,0,.79,0);
    this.legs=[];this.arms=[];for(const sign of [-1,1]){const leg=new T.Group();leg.position.set(sign*.13,.72,0);this.body.add(leg);add(leg,new T.CylinderGeometry(.08,.07,.35,7),skin,0,-.13,0);add(leg,new T.CylinderGeometry(.075,.06,.30,7),socks,0,-.42,0);const foot=add(leg,new T.BoxGeometry(.15,.12,.3),boot,0,-.64,.07);this.legs.push(leg);if(sign===1)this.boot=foot;const arm=new T.Group();arm.position.set(sign*.32,1.32,0);this.body.add(arm);add(arm,new T.CylinderGeometry(.075,.06,.4,7),skin,0,-.17,0);this.arms.push(arm);}
    // Articulated elbows, wrists and hands: opposite arm/leg swing with bent elbows.
    this.forearms=[];this.hands=[];this.arms.forEach((arm,i)=>{const upper=arm.children[0];upper.scale.y=.64;upper.position.y=-.12;const elbow=new T.Group();elbow.position.y=-.25;arm.add(elbow);add(elbow,new T.CylinderGeometry(.056,.045,.24,8),skin,0,-.12,0);const hand=add(elbow,new T.SphereGeometry(.06,8,6),skin,0,-.27,0);hand.scale.set(.8,1.3,.7);this.forearms.push(elbow);this.hands.push(hand);arm.rotation.z=(i===0?1:-1)*.12;});
    // Procedural shirt number keeps the template self-contained.
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#18332c';ctx.font='bold 45px Arial';ctx.textAlign='center';ctx.fillText(String(this.number),32,49);const num=new T.Mesh(new T.PlaneGeometry(.22,.25),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,side:T.DoubleSide}));num.position.set(0,1.2,-.256);num.rotation.y=Math.PI;this.body.add(num);
    this.label=document.createElement('span');this.label.className='player-label';this.label.textContent=this.name;document.querySelector('#player-labels').append(this.label);
    this.playstyle=null;this.playstyleIcon=new T.Sprite(new T.SpriteMaterial({transparent:true,depthTest:false,depthWrite:false}));this.playstyleIcon.scale.set(.72,.72,1);this.playstyleIcon.position.set(0,2.28,0);this.playstyleIcon.visible=false;this.playstyleIcon.renderOrder=999;this.body.add(this.playstyleIcon);
  }
  reset(x,z){this.home.set(x,0,z);this.position.copy(this.home);this.velocity.set(0,0,0);this.facing.set(this.team===0?1:-1,0,0);this.cooldown=0;this.slide=0;this.pending=null;this.stamina=1;this.kickTime=0;this.hasBall=false;this.controlLock=0;this.skillCooldown=0;this.skillTime=0;this.skillType=null;this.tackle=0;this.tackleCooldown=0;this.tackleConnected=false;this.turnLean=0;this.playstyle=null;if(this.playstyleIcon)this.playstyleIcon.visible=false;this.acceleration=new T.Vector3();this.animate(0);}
  startTackle(sliding=false){if(this.tackleCooldown>0||this.stamina<(sliding?.2:.06)||this.hasBall)return false;this.tackle=sliding?.5:.27;this.tackleCooldown=sliding?1.2:.7;this.tackleConnected=false;this.stamina-=sliding?.18:.045;if(sliding){this.slide=.5;this.velocity.addScaledVector(this.facing,3);}return true;}
  move(direction,sprint,dt,lookDirection=null){
    for(const timer of ['cooldown','slide','controlLock','skillCooldown','skillTime','tackle','tackleCooldown'])this[timer]=Math.max(0,this[timer]-dt);
    const running=sprint&&this.stamina>.08;let speed=(this.keeper?4.8:running?8.4:5.6)*(this.hasBall?.95:1);if(this.playstyle&&this.playstyle.type==='quickstep')speed*=1.6;
    const dir=direction.clone().setY(0);if(dir.lengthSq()>1)dir.normalize();const currentSpeed=this.velocity.length();let turn=0;
    if(lookDirection)this.facing.copy(lookDirection);
    else if(dir.lengthSq()>.01&&this.slide<=0){const from=Math.atan2(this.facing.x,this.facing.z),to=Math.atan2(dir.x,dir.z);const difference=Math.atan2(Math.sin(to-from),Math.cos(to-from));const maxTurn=(14.0-currentSpeed*.28)*(this.hasBall?.96:1)*dt;turn=clamp(difference,-maxTurn,maxTurn);this.facing.set(Math.sin(from+turn),0,Math.cos(from+turn));}
    const dot=dir.lengthSq()>.01?this.facing.dot(dir):0;
    const alignment=dir.lengthSq()>.01?Math.max(.7,(1+dot)*.5):0;
    const moveHeading=dir.lengthSq()>.01?this.facing.clone().lerp(dir,.62).normalize():this.facing;
    const targetSpeed=this.skillTime>0?Math.max(speed,7.2):speed;
    const target=lookDirection&&this.slide<=0?dir.clone().multiplyScalar(targetSpeed*(dot<-.2?.72:1)):moveHeading.clone().multiplyScalar(this.slide>0?9:dir.length()*targetSpeed*alignment);
    const delta=target.sub(this.velocity),braking=dir.lengthSq()<.01||this.velocity.dot(delta)<0;
    delta.clampLength(0,(this.slide>0?8.5:braking?26:running?22:19)*dt);
    this.acceleration.copy(delta).divideScalar(Math.max(dt,.0001));this.velocity.add(delta);this.position.addScaledVector(this.velocity,dt);
    this.position.x=clamp(this.position.x,-29.4,29.4);this.position.z=clamp(this.position.z,-18.5,18.5);
    this.turnLean+=(clamp(-turn/Math.max(dt,.0001)*currentSpeed*.009,-.2,.2)-this.turnLean)*(1-Math.exp(-dt*8));
    this.stamina=clamp(this.stamina+(running&&dir.lengthSq()>.1?-.09:.08)*dt,0,1);
  }
  animate(dt){this.boot.getWorldPosition(this.bootPrevious);this.mesh.position.copy(this.position);this.mesh.rotation.y=Math.atan2(this.facing.x,this.facing.z);this.runPhase+=dt*this.velocity.length()*2.6;this.kickTime=Math.max(0,this.kickTime-dt);const stride=Math.min(1,this.velocity.length()/5.6);this.legs[0].rotation.x=Math.sin(this.runPhase)*.65*stride;this.legs[1].rotation.x=-Math.sin(this.runPhase)*.65*stride;this.arms[0].rotation.x=-Math.sin(this.runPhase)*.5*stride;this.arms[1].rotation.x=Math.sin(this.runPhase)*.5*stride;
    this.arms.forEach((arm,i)=>{const phase=this.runPhase+i*Math.PI;arm.rotation.x=-Math.sin(phase)*(.38+stride*.45)*stride;arm.rotation.z=(i===0?1:-1)*(.1+stride*.07)+this.turnLean*.4;this.forearms[i].rotation.x=-.18-stride*.95+Math.cos(phase)*stride*.18;this.hands[i].rotation.z=Math.sin(phase)*stride*.16;});
    if(this.kickTime>0)this.legs[1].rotation.x=-Math.sin((.24-this.kickTime)/.24*Math.PI)*1.35;
    this.legs[1].rotation.z=0;
    if(this.skillTime>0&&this.skillType==='sombrero')this.legs[1].rotation.x=-Math.sin((1-this.skillTime/.65)*Math.PI)*1.5;
    if(this.skillTime>0&&this.skillType==='elastica'){const wave=Math.sin((1-this.skillTime/.58)*Math.PI*2);this.legs[1].rotation.z=wave*.65;this.legs[1].rotation.x=-.45;}
    if(this.tackle>0&&this.slide<=0)this.legs[1].rotation.x=-Math.sin(this.tackle/.27*Math.PI)*1.1;
    this.body.rotation.x=this.slide>0?-1.1:clamp(this.velocity.length()*.016+this.acceleration.dot(this.facing)*.003,-.06,.2);
    this.body.rotation.z=this.slide>0?.23:this.turnLean;this.body.position.y=this.slide>0?-.5:Math.abs(Math.sin(this.runPhase))*.04*stride;this.mesh.updateMatrixWorld(true);this.boot.getWorldPosition(this.bootCurrent);
  }
  dispose(scene){scene.remove(this.mesh);this.mesh.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});this.label.remove();}
}
