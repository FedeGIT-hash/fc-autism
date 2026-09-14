import * as T from 'three';
import { clamp } from './config.js';

export class Environment {
  constructor(scene,stadium){this.scene=scene;this.stadium=stadium;this.mode='dusk';this.weather='clear';this.phase=.18;this.elapsed=0;
    this.sun=new T.DirectionalLight(0xffcf95,2.1);this.sun.position.set(-55,24,-60);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-48,right:48,top:42,bottom:-42,near:1,far:220});this.sun.shadow.normalBias=.12;this.sun.shadow.bias=-.0004;scene.add(this.sun);
    this.ambient=new T.HemisphereLight(0x9dbac6,0x374832,1.6);scene.add(this.ambient);
    scene.fog=new T.FogExp2(0x53676c,.0036);
    const skyGeo=new T.SphereGeometry(600,32,16);this.sky=new T.Mesh(skyGeo,new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color(0x34556d)},bottom:{value:new T.Color(0xcda584)}},vertexShader:'varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 v;void main(){float h=clamp(normalize(v).y*2.2,0.,1.);gl_FragColor=vec4(mix(bottom,top,pow(h,.65)),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));scene.add(this.sky);
    const n=1300,positions=new Float32Array(n*3);for(let i=0;i<n;i++){positions[i*3]=(Math.random()-.5)*85;positions[i*3+1]=Math.random()*30;positions[i*3+2]=(Math.random()-.5)*60;}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));this.rain=new T.Points(geo,new T.PointsMaterial({color:0xd0e5e9,size:.07,transparent:true,opacity:.55,depthWrite:false}));scene.add(this.rain);this.update(0);
  }
  update(dt){this.elapsed+=dt;if(this.mode==='cycle')this.phase=(this.phase+dt/160)%1;
    const elevation=this.mode==='day'?.85:this.mode==='night'?-.4:this.mode==='cycle'?Math.sin(this.phase*Math.PI*2):.18;
    const daylight=clamp((elevation+.12)/.9,0,1),night=1-clamp(elevation/.25,0,1);
    this.sun.position.set(-65*Math.cos(this.elapsed*.003),elevation*85,-60);this.sun.intensity=daylight*2.7;this.sun.color.setHSL(.08+daylight*.055,.4-daylight*.2,.78);
    this.ambient.intensity=.65+daylight*1.35;this.sky.material.uniforms.top.value.set(0x101f39).lerp(new T.Color(0x5e91ad),daylight);this.sky.material.uniforms.bottom.value.set(0x26384b).lerp(new T.Color(this.mode==='day'?0xbacccd:0xe9b58b),clamp(daylight*2,0,1));
    this.scene.fog.color.copy(this.sky.material.uniforms.bottom.value);this.scene.fog.density=this.weather==='rain'?.008:this.mode==='night'?.005:.003;
    this.stadium.lamps.forEach(l=>l.intensity=night*650);this.stadium.lampPanels.forEach(m=>{m.emissiveIntensity=.2+night*3;m.userData.halo.material.opacity=night*.8;});
    this.rain.visible=this.weather==='rain';this.stadium.grassMaterial.roughness=this.rain.visible?.48:.92;
    if(this.rain.visible){const a=this.rain.geometry.attributes.position;for(let i=0;i<a.count;i++){a.array[i*3]+=.8*dt;a.array[i*3+1]-=17*dt;if(a.array[i*3+1]<0){a.array[i*3+1]=30;a.array[i*3]=(Math.random()-.5)*85;}}a.needsUpdate=true;}
  }
}

/** Reusable particle pool: grass from tackles, sweat from sprinting, flare smoke. */
export class Effects {
  constructor(scene){this.items=[];this.max=450;this.positions=new Float32Array(this.max*3);this.colors=new Float32Array(this.max*3);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(this.positions,3));geo.setAttribute('color',new T.BufferAttribute(this.colors,3));this.points=new T.Points(geo,new T.PointsMaterial({size:.13,vertexColors:true,transparent:true,opacity:.8,depthWrite:false}));this.points.frustumCulled=false;scene.add(this.points);this.smokeTime=0;}
  burst(position,count=14,type='grass'){for(let i=0;i<count&&this.items.length<this.max;i++){this.items.push({p:position.clone().add(new T.Vector3(0,.12,0)),v:new T.Vector3((Math.random()-.5)*4,Math.random()*3+.5,(Math.random()-.5)*4),life:type==='smoke'?4:.6+Math.random()*.5,type,c:new T.Color(type==='sweat'?0xc4e6ea:type==='smoke'?0xb99481:0x8da752)});}}
  update(dt,night){this.smokeTime+=dt;if(night&&this.smokeTime>.13){this.smokeTime=0;this.burst(new T.Vector3(-15,5,-29),2,'smoke');}for(let i=this.items.length-1;i>=0;i--){const a=this.items[i];a.life-=dt;if(a.life<=0){this.items.splice(i,1);continue;}a.v.y+=(a.type==='smoke'?.2:-7)*dt;a.p.addScaledVector(a.v,dt);if(a.p.y<.04){a.p.y=.04;a.v.multiplyScalar(.6);}}for(let i=0;i<this.items.length;i++){const a=this.items[i];a.p.toArray(this.positions,i*3);a.c.toArray(this.colors,i*3);}this.points.geometry.setDrawRange(0,this.items.length);this.points.geometry.attributes.position.needsUpdate=true;this.points.geometry.attributes.color.needsUpdate=true;}
}

export class StadiumAudio {
  constructor(){this.enabled=false;this.ctx=null;}
  setEnabled(enabled){this.enabled=enabled;if(enabled&&!this.ctx){try{this.ctx=new AudioContext();const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*3,this.ctx.sampleRate);const data=buffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.03)/1.02;data[i]=last;}this.source=this.ctx.createBufferSource();this.source.buffer=buffer;this.source.loop=true;const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=800;this.gain=this.ctx.createGain();this.gain.gain.value=.35;this.source.connect(filter).connect(this.gain).connect(this.ctx.destination);this.source.start();}catch{this.enabled=false;}}if(this.ctx){this.ctx.resume();this.gain.gain.setTargetAtTime(enabled?.35:0,this.ctx.currentTime,.2);}}
  tone(frequency,duration=.1){if(!this.enabled||!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.frequency.value=frequency;g.gain.setValueAtTime(.08,this.ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,this.ctx.currentTime+duration);o.connect(g).connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+duration);}
}
