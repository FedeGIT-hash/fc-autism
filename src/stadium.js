import * as T from 'three';
import { PITCH } from './config.js';

const standard=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.85,...extra});
function box(parent,w,h,d,x,y,z,material){const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;}
function cylinderBetween(parent,a,b,r,mat){const d=b.clone().sub(a);const m=new T.Mesh(new T.CylinderGeometry(r,r,d.length(),8),mat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());m.castShadow=true;parent.add(m);return m;}
function canvasTexture(draw,size=512){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;}

export class Stadium {
  constructor(scene,id='sol'){this.id=id;this.scene=scene;this.group=new T.Group();scene.add(this.group);this.lamps=[];this.lampPanels=[];this.buildPitch();this.buildGoals();this.buildStands();this.buildLights();this.buildSurroundings();if(id==='marina')this.buildMarina();}
  setVisible(visible){this.group.visible=visible;this.lamps.forEach(l=>l.visible=visible);}
  buildMarina(){
    this.grassMaterial.color.set(0x99c7bc);
    const white=standard(0xcedee1,{metalness:.55,roughness:.45}),blue=new T.MeshStandardMaterial({color:0x2984b0,emissive:0x27b4f3,emissiveIntensity:1.3});
    // Elevated bowstring arches and end canopies give this venue a distinct silhouette.
    for(const z of [-32,32]){
      const points=[];for(let i=0;i<=36;i++){const x=-43+i*86/36;points.push(new T.Vector3(x,12+12*Math.sin(i/36*Math.PI),z));}
      const curve=new T.CatmullRomCurve3(points),arch=new T.Mesh(new T.TubeGeometry(curve,72,.26,8,false),white);arch.castShadow=true;this.group.add(arch);
      const light=new T.Mesh(new T.TubeGeometry(curve,72,.07,6,false),blue);light.position.z+=z>0?-.4:.4;this.group.add(light);
      for(let i=2;i<35;i+=3){const p=points[i];cylinderBetween(this.group,new T.Vector3(p.x,11,z),p,.04,white);}
      box(this.group,82,.14,.2,0,9.5,z>0?25:-25,blue);
    }
    for(const sign of [-1,1]){
      const canopy=box(this.group,10,.35,52,sign*41,9.7,0,white);canopy.rotation.z=sign*.09;
      box(this.group,.18,.2,51,sign*35.9,9.2,0,blue);
      for(let z=-23;z<=23;z+=5.75)cylinderBetween(this.group,new T.Vector3(sign*45,0,z),new T.Vector3(sign*44,10,z),.14,white);
    }
    const tex=canvasTexture((ctx,s)=>{ctx.fillStyle='#071d31';ctx.fillRect(0,0,s,s);ctx.strokeStyle='#50ceff';ctx.lineWidth=12;ctx.strokeRect(12,12,s-24,s-24);ctx.textAlign='center';ctx.fillStyle='#9fe4ff';ctx.font='bold 56px Arial';ctx.fillText('ARENA',s/2,210);ctx.fillText('MARINA',s/2,280);ctx.font='20px Arial';ctx.fillText('VIVE EL JUEGO DESDE DENTRO',s/2,360);});
    const screen=new T.MeshBasicMaterial({map:tex});for(const sign of [-1,1]){const m=new T.Mesh(new T.PlaneGeometry(10,6),screen);m.position.set(sign*40,14,0);m.rotation.y=-sign*Math.PI/2;this.group.add(m);}
    this.group.traverse(o=>{if(o.isInstancedMesh&&o===this.seats){for(let i=0;i<o.count;i++)o.setColorAt(i,new T.Color(i%7<2?0xd3e9ed:i%7<5?0x206899:0x2ea3bb));o.instanceColor.needsUpdate=true;}});
  }
  buildPitch(){
    const texture=canvasTexture((ctx,s)=>{ctx.fillStyle='#447543';ctx.fillRect(0,0,s,s);for(let i=0;i<52000;i++){const l=50+Math.random()*65;ctx.fillStyle=`rgba(${l*.7},${l},${l*.45},${.2+Math.random()*.4})`;ctx.fillRect(Math.random()*s,Math.random()*s,1,2+Math.random()*4);}});
    texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(15,10);texture.anisotropy=8;
    const normal=canvasTexture((ctx,s)=>{ctx.fillStyle='#8080ff';ctx.fillRect(0,0,s,s);for(let i=0;i<20000;i++){ctx.fillStyle=`rgb(${100+Math.random()*55},${110+Math.random()*40},245)`;ctx.fillRect(Math.random()*s,Math.random()*s,1,5);}},256);normal.colorSpace=T.NoColorSpace;normal.wrapS=normal.wrapT=T.RepeatWrapping;normal.repeat.set(20,12);
    this.grassMaterial=standard(0xc1d0a8,{map:texture,normalMap:normal,normalScale:new T.Vector2(.32,.32)});
    box(this.group,76,.3,54,0,-.2,0,standard(0x283b31));
    const pitch=new T.Mesh(new T.PlaneGeometry(68,46),this.grassMaterial);pitch.rotation.x=-Math.PI/2;pitch.position.y=-.025;pitch.receiveShadow=true;this.group.add(pitch);
    for(let i=0;i<12;i++)if(i%2===0){const m=new T.Mesh(new T.PlaneGeometry(5,38),new T.MeshStandardMaterial({color:0xa8ce8b,transparent:true,opacity:.10,roughness:.95,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(-27.5+i*5,.002,0);m.receiveShadow=true;this.group.add(m);}
    const lineMat=new T.MeshBasicMaterial({color:0xf1f0d7,transparent:true,opacity:.85});
    const line=(x,z,w,d)=>box(this.group,w,.014,d,x,.012,z,lineMat);
    line(0,-19,60,.095);line(0,19,60,.095);line(-30,0,.095,38);line(30,0,.095,38);line(0,0,.085,38);
    const circle=(x,z,r,start=0,angle=Math.PI*2)=>{const m=new T.Mesh(new T.RingGeometry(r-.045,r+.045,96,1,start,angle),lineMat);m.rotation.x=-Math.PI/2;m.position.set(x,.023,z);this.group.add(m);};circle(0,0,5.4);
    for(const sign of [-1,1]){line(sign*24.5,-10,11,.09);line(sign*24.5,10,11,.09);line(sign*19,0,.09,20);line(sign*28,-5.3,4,.09);line(sign*28,5.3,4,.09);line(sign*26,0,.09,10.6);circle(sign*22,0,.12);circle(sign*22,0,4.3,sign>0?Math.PI*.75:-Math.PI*.25,Math.PI*.5);
      for(const z of [-19,19]){cylinderBetween(this.group,new T.Vector3(sign*30,0,z),new T.Vector3(sign*30,1.55,z),.025,standard(0xe9ebc4));const flag=box(this.group,.5,.28,.025,sign*30+.22,1.42,z,standard(0xdaff78));flag.castShadow=true;}}
    circle(0,0,.12);
    const boardTex=canvasTexture((ctx,s)=>{ctx.fillStyle='#172d2b';ctx.fillRect(0,0,s,s);ctx.fillStyle='#daff78';ctx.font='bold 46px Arial';ctx.textAlign='center';ctx.fillText('FC AUTISM',s/2,160);ctx.font='23px Arial';ctx.fillStyle='#c3d3c6';ctx.fillText('THE BEAUTIFUL GAME',s/2,205);ctx.fillStyle='#daff78';ctx.font='bold 40px Arial';ctx.fillText('JUEGA TU MOMENTO',s/2,405);});
    const board=new T.MeshStandardMaterial({map:boardTex,emissiveMap:boardTex,emissive:0xffffff,emissiveIntensity:.35,roughness:.6});
    for(const z of [-22,22])for(let i=0;i<10;i++)box(this.group,6,1,.15,-28+i*6,.6,z,board);
    for(const x of [-34,34])for(let i=0;i<6;i++)box(this.group,.15,1,5.7,x,.6,-15+i*6,board);
  }
  buildGoals(){
    const white=standard(0xebebe1,{metalness:.25,roughness:.4});const netmat=new T.LineBasicMaterial({color:0xd4dfd3,transparent:true,opacity:.36});
    for(const sign of [-1,1]){const x=30*sign,back=x+sign*2.5,w=PITCH.goalWidth/2,h=PITCH.goalHeight;
      for(const z of [-w,w]){cylinderBetween(this.group,new T.Vector3(x,0,z),new T.Vector3(x,h,z),.065,white);cylinderBetween(this.group,new T.Vector3(x,h,z),new T.Vector3(back,.1,z),.025,white);}
      cylinderBetween(this.group,new T.Vector3(x,h,-w),new T.Vector3(x,h,w),.065,white);
      const vertices=[];const seg=(a,b)=>vertices.push(...a,...b);
      for(let z=-w;z<=w;z+=.25){seg([x,h,z],[back,h,z]);seg([back,0,z],[back,h,z]);}
      for(let y=0;y<=h;y+=.24){seg([back,y,-w],[back,y,w]);for(const z of [-w,w])seg([x,y,z],[back,y,z]);}
      for(let xx=0;xx<=2.5;xx+=.25){seg([x+sign*xx,h,-w],[x+sign*xx,h,w]);for(const z of [-w,w])seg([x+sign*xx,0,z],[x+sign*xx,h,z]);}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));this.group.add(new T.LineSegments(geo,netmat));
    }
  }
  buildStands(){
    const concrete=standard(0x263b3c),edge=standard(0x82938c,{metalness:.4}),roof=standard(0x263b41,{metalness:.5,roughness:.65});
    const seats=new T.InstancedMesh(new T.BoxGeometry(.55,.4,.55),standard(0xffffff),5000);const dummy=new T.Object3D(),color=new T.Color();let count=0;
    const crowd=new T.InstancedMesh(new T.BoxGeometry(.32,.58,.28),standard(0xffffff),4000);let people=0;
    for(const sign of [-1,1])for(let row=0;row<12;row++){
      const y=.6+row*.65,z=sign*(24+row*.8);box(this.group,76,.65,1.15,0,y-.45,z,concrete);
      for(let col=0;col<99;col++){if(col%25<2)continue;const x=-36+col*.74;dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.updateMatrix();seats.setMatrixAt(count,dummy.matrix);color.set(row%4===0?0xb9c7b5:col%25<12?0x3b666b:0x50777a);seats.setColorAt(count++,color);
        if(Math.random()>.25){dummy.position.y+=.43;dummy.updateMatrix();crowd.setMatrixAt(people,dummy.matrix);color.set([0x9da593,0x23383b,0xb9bd9b,0x6a8480,0x273c47,0xd5c3a0][Math.floor(Math.random()*6)]);crowd.setColorAt(people++,color);}}
    }
    for(const sign of [-1,1])for(let row=0;row<9;row++){const x=sign*(36+row*.8),y=.6+row*.65;box(this.group,1.15,.65,48,x,y-.45,0,concrete);for(let col=0;col<62;col++){if(col%21<2)continue;dummy.position.set(x,y,-22.5+col*.74);dummy.updateMatrix();seats.setMatrixAt(count,dummy.matrix);color.set(row%4===0?0xb9c7b5:0x446b70);seats.setColorAt(count++,color);if(Math.random()>.35&&people<4000){dummy.position.y+=.43;dummy.updateMatrix();crowd.setMatrixAt(people,dummy.matrix);color.set([0x294749,0x9ca699,0x6b7c73][Math.floor(Math.random()*3)]);crowd.setColorAt(people++,color);}}}
    this.seats=seats;seats.count=count;crowd.count=people;this.group.add(seats,crowd);
    for(const sign of [-1,1]){
      box(this.group,79,.4,12,0,11,sign*31.5,roof);
      box(this.group,79,.25,.25,0,10.5,sign*25.5,edge);
      for(let x=-38;x<=38;x+=7.6){cylinderBetween(this.group,new T.Vector3(x,0,sign*34),new T.Vector3(x,11,sign*34),.13,edge);cylinderBetween(this.group,new T.Vector3(x,10.5,sign*25.5),new T.Vector3(x,11.5,sign*36),.08,edge);}
      box(this.group,.35,7,49,sign*44,3,0,concrete);
    }
  }
  buildLights(){
    const steel=standard(0x6e8587,{metalness:.8,roughness:.4});
    for(const x of [-34,34])for(const z of [-23,23]){
      cylinderBetween(this.group,new T.Vector3(x,0,z),new T.Vector3(x,23,z),.15,steel);
      cylinderBetween(this.group,new T.Vector3(x-1,0,z),new T.Vector3(x,23,z),.06,steel);
      const panel=box(this.group,4.2,1.65,.3,x,23,z,steel);panel.lookAt(0,8,0);
      const emissive=new T.MeshStandardMaterial({color:0xfff4d6,emissive:0xffe9ba,emissiveIntensity:2});
      for(let i=0;i<6;i++)for(let j=0;j<2;j++){const m=new T.Mesh(new T.PlaneGeometry(.5,.53),emissive);m.position.set(-1.7+i*.67,-.38+j*.76,.17);panel.add(m);}
      this.lampPanels.push(emissive);
      const light=new T.SpotLight(0xfff0d7,850,100,Math.PI/3,.65,1.35);light.position.set(x,22.8,z);light.target.position.set(x*.15,0,z*.1);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.bias=-.0006;light.shadow.normalBias=.06;light.shadow.camera.near=2;light.shadow.camera.far=90;this.scene.add(light,light.target);this.lamps.push(light);
      const haloTex=canvasTexture((ctx,s)=>{const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,'rgba(255,247,220,.5)');g.addColorStop(.15,'rgba(255,245,210,.12)');g.addColorStop(1,'rgba(255,245,210,0)');ctx.fillStyle=g;ctx.fillRect(0,0,s,s);},128);
      const halo=new T.Sprite(new T.SpriteMaterial({map:haloTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));halo.position.set(x,23,z);halo.scale.set(13,13,1);this.group.add(halo);emissive.userData.halo=halo;
    }
  }
  buildSurroundings(){
    box(this.group,1200,.5,1200,0,-.8,0,standard(0x203231));
    const mountains=standard(0x33474e);for(let i=0;i<30;i++){const m=new T.Mesh(new T.ConeGeometry(25+Math.random()*45,20+Math.random()*50,5),mountains);const a=i/30*Math.PI*2;m.position.set(Math.cos(a)*260,8,Math.sin(a)*260);m.rotation.y=Math.random()*6;this.group.add(m);}
    const city=standard(0x2b3e47);for(let i=0;i<45;i++){const x=(i-22)*9;const h=5+Math.random()*17;box(this.group,5+Math.random()*4,h,7,x,h/2-1,-120-Math.random()*40,city);}
  }
}
