import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { BallPhysics } from '../src/physics.js';
import { BALL } from '../src/config.js';

test('la resistencia y el césped disipan energía sin hundir el balón',()=>{const b=new BallPhysics();b.kick(new Vector3(1,0,0),6);for(let i=0;i<360;i++)b.step(1/120);assert.ok(b.velocity.length()<6);assert.ok(b.position.y>=BALL.radius);assert.ok(Number.isFinite(b.position.x));});
test('el efecto Magnus curva en sentidos opuestos según el giro',()=>{const run=curve=>{const b=new BallPhysics();b.reset(-20,0);b.position.y=4;b.kick(new Vector3(1,0,0),15,4,curve);for(let i=0;i<60;i++)b.step(1/120);return b.position.z;};assert.ok(run(1)<-.1);assert.ok(run(-1)>.1);assert.ok(Math.abs(run(0))<1e-9);});
test('el césped mojado reduce el rebote',()=>{const bounce=wet=>{const b=new BallPhysics();b.wet=wet;b.position.y=.23;b.velocity.y=-5;b.step(1/120);return b.velocity.y;};assert.ok(bounce(false)>bounce(true));assert.ok(bounce(true)>0);});
test('un gol exige que el balón completo cruce bajo el larguero',()=>{const b=new BallPhysics();let scored=-1;b.onGoal=t=>scored=t;b.reset(29.9,0);b.velocity.x=40;b.step(1/120);assert.equal(scored,0);const high=new BallPhysics();high.position.set(29.9,3,0);high.velocity.x=40;high.onGoal=()=>assert.fail('Tiro alto contado como gol');high.step(1/120);});
test('el barrido evita atravesar el poste a gran velocidad',()=>{const b=new BallPhysics();b.position.set(29,1,3.66);b.velocity.x=150;b.step(1/120);assert.ok(b.velocity.x<0);});
test('un golpe necesita contacto espacial con la bota',()=>{const b=new BallPhysics();assert.equal(b.bootContact(new Vector3(-1,.22,0),new Vector3(1,.22,0)),true);assert.equal(b.bootContact(new Vector3(-1,2,0),new Vector3(1,2,0)),false);});
test('un saque se dispara cuando el balón sale de banda',()=>{const b=new BallPhysics();let out=0;b.onOut=()=>out++;b.position.z=19.4;b.step(1/120);assert.equal(out,1);});
