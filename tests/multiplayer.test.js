import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three';
import { Match } from '../src/match.js';
import { MultiplayerManager } from '../src/multiplayer.js';

// Mock DOM for headless node test environment
const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
globalThis.document = {
  createElement: () => ({ getContext: () => ctx, remove() {}, className: '', textContent: '' }),
  querySelector: () => ({ append() {} })
};

const ROSTER = [
  { id: 'p1', username: 'ana', side: 0, slot: 0 },
  { id: 'p2', username: 'leo', side: 1, slot: 0 }
];

function makeInput() {
  return {
    clear() { this.release = null; },
    update() {},
    take() { return false; },
    direction() { return { x: 0, z: 0 }; },
    curve: 0,
    sprint: false,
    release: null
  };
}

function makeDummyMp() {
  return {
    remoteInputs: new Map(),
    sendInput() {},
    sendSnapshot() {},
    sendEvent() {}
  };
}

function fixture(isHost = true, localId = isHost ? 'p1' : 'p2') {
  const input = makeInput();
  const dummyMp = makeDummyMp();
  const m = new Match(new Scene(), input, { burst() {} }, { tone() {} });
  m.setupMultiplayer(dummyMp, isHost, ROSTER, localId, { team: 0, duration: 180 });
  m.running = true;
  return { m, input, dummyMp };
}

test('el modo multijugador asigna cada jugador al slot y equipo elegidos', () => {
  const host = fixture(true).m;
  const guest = fixture(false).m;

  assert.equal(host.isMultiplayer, true);
  assert.equal(host.isHost, true);
  assert.equal(host.active.team, 0); // p1 eligió side 0 (local)
  assert.equal(host.active.index, 0);
  assert.equal(host.remote.get('p2').team, 1);

  assert.equal(guest.isMultiplayer, true);
  assert.equal(guest.isHost, false);
  assert.equal(guest.active.team, 1); // p2 eligió side 1 (rival)
});

test('el host genera un snapshot compacto y el guest lo aplica', () => {
  const host = fixture(true).m;
  const guest = fixture(false).m;

  host.ball.position.set(5.5, 0.22, -3.2);
  host.ball.velocity.set(12, 0, -4);
  host.score = [2, 1];
  host.elapsed = 45.5;

  const snap = host.getSnapshot();
  assert.equal(snap.s[0], 2);
  assert.equal(snap.s[1], 1);
  assert.equal(snap.p.length, 10);
  assert.ok(Array.isArray(snap.b.p));

  guest.applySnapshot(snap);
  assert.equal(guest.score[0], 2);
  assert.equal(guest.score[1], 1);
  assert.equal(guest.elapsed, 45.5);
  assert.ok(Math.abs(guest.ball.position.x - 5.5) < 3);
});

test('el input de un rival mueve a su jugador en el host', () => {
  const { m: host, dummyMp } = fixture(true);
  const rival = host.remote.get('p2');
  assert.ok(rival);

  dummyMp.remoteInputs.set('p2', { x: -1, z: 0, sprint: true });

  const startX = rival.position.x;
  for (let i = 0; i < 30; i++) host.step(1 / 120);

  assert.ok(rival.position.x < startX, `El rival no avanzó en dirección -X: ${rival.position.x}`);
});

test('el cambio de jugador funciona en multijugador sin tomar un jugador humano ajeno', () => {
  const host = fixture(true).m;
  const oldActive = host.active;
  host.switchPlayer(0);
  assert.notEqual(host.active, oldActive);
  assert.equal(host.active.remoteId, undefined);
});

test('el cambio de un invitado se sincroniza con el anfitrión', () => {
  const { m: host } = fixture(true);
  const oldRemote = host.remote.get('p2');
  const next = host.switchRemotePlayer('p2');
  assert.ok(next);
  assert.notEqual(next, oldRemote);
  assert.equal(host.remote.get('p2'), next);
  assert.equal(next.remoteId, 'p2');
  assert.equal(oldRemote.remoteId, null);
});

test('el generador de salas produce códigos válidos de 4 caracteres', () => {
  const code = MultiplayerManager.generateRoomCode();
  assert.equal(code.length, 4);
  assert.match(code, /^[2-9A-Z]{4}$/);
});

test('los eventos de borde (tiro/regate) no se pierden con los frames vacíos', () => {
  const mp = new MultiplayerManager();
  mp.isHost = true;

  mp.handleInput({ id: 'p2', input: { x: 0, z: 0, sprint: false, kick: { type: 'shot', time: 0.7, curve: 0 }, skill: null, tackle: false, slideTackle: false } });
  mp.handleInput({ id: 'p2', input: { x: 0, z: 0, sprint: false, kick: null, skill: null, tackle: false, slideTackle: false } });
  mp.handleInput({ id: 'p2', input: { x: 0, z: 0, sprint: false, kick: null, skill: null, tackle: false, slideTackle: false } });

  assert.equal(mp.remoteInputs.get('p2').kick.type, 'shot');
  assert.equal(mp.remoteInputs.get('p2').kick.time, 0.7);

  mp.handleInput({ id: 'p2', input: { x: -1, z: 1, sprint: true, kick: null, skill: null, tackle: false, slideTackle: false } });
  assert.equal(mp.remoteInputs.get('p2').x, -1);
  assert.equal(mp.remoteInputs.get('p2').z, 1);
  assert.equal(mp.remoteInputs.get('p2').kick.type, 'shot');

  mp.handleInput({ id: 'p2', input: { x: 0, z: 0, sprint: false, kick: null, skill: null, tackle: false, slideTackle: true } });
  mp.handleInput({ id: 'p2', input: { x: 0, z: 0, sprint: false, kick: null, skill: null, tackle: false, slideTackle: false } });
  assert.equal(mp.remoteInputs.get('p2').slideTackle, true);
});

test('un input reciente queda marcado para evitar movimiento atascado al desconectarse', () => {
  const mp = new MultiplayerManager();
  mp.isHost = true;
  mp.handleInput({ id: 'p2', input: { x: 1, z: 0, sprint: true } });
  assert.equal(mp.remoteInputs.get('p2').x, 1);
  assert.ok(Number.isFinite(mp.remoteInputs.get('p2').updatedAt));
});

test('el anfitrión limita los snapshots para no saturar Realtime', () => {
  const { m: host, dummyMp } = fixture(true);
  let snapshots = 0;
  dummyMp.sendSnapshot = () => snapshots++;
  for (let i = 0; i < 120; i++) host.step(1 / 120);
  assert.equal(snapshots, 20);
});
