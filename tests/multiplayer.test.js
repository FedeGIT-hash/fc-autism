import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3 } from 'three';
import { Match } from '../src/match.js';
import { MultiplayerManager } from '../src/multiplayer.js';

// Mock DOM for headless node test environment
const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
globalThis.document = {
  createElement: () => ({ getContext: () => ctx, remove() {}, className: '', textContent: '' }),
  querySelector: () => ({ append() {} })
};

function fixture(isHost = true) {
  const input = {
    clear() { this.release = null; },
    update() {},
    take() { return false; },
    direction() { return { x: 0, z: 0 }; },
    curve: 0,
    sprint: false,
    release: null
  };
  const dummyMp = {
    remoteInput: { x: 0, z: 0, sprint: false, kick: null, skill: null, tackle: false, slideTackle: false, switchPlayer: false },
    sendInput() {},
    sendSnapshot() {},
    sendEvent() {}
  };
  const m = new Match(new Scene(), input, { burst() {} }, { tone() {} });
  m.setupMultiplayer(dummyMp, isHost, 0, 180);
  m.running = true;
  return { m, input, dummyMp };
}

test('el modo multijugador asigna equipos opuestos a host y guest', () => {
  const host = fixture(true).m;
  const guest = fixture(false).m;

  assert.equal(host.isMultiplayer, true);
  assert.equal(host.isHost, true);
  assert.equal(host.active.team, 0); // P1 controla SOL FC (Team 0)
  assert.equal(host.guestActive.team, 1);

  assert.equal(guest.isMultiplayer, true);
  assert.equal(guest.isHost, false);
  assert.equal(guest.active.team, 1); // P2 controla MARINA FC (Team 1)
});

test('el host genera un snapshot compacto y el guest lo aplica fielmente', () => {
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

test('los inputs del guest mueven al jugador rival en el host', () => {
  const { m: host, dummyMp } = fixture(true);
  const guestPlayer = host.guestActive;
  assert.ok(guestPlayer);

  // Simular que el guest envía un movimiento hacia la izquierda (-X)
  dummyMp.remoteInput = { x: -1, z: 0, sprint: true, kick: null, skill: null, tackle: false, slideTackle: false, switchPlayer: false };

  const startX = guestPlayer.position.x;
  for (let i = 0; i < 30; i++) {
    host.step(1 / 120);
  }

  assert.ok(guestPlayer.position.x < startX, `El rival no avanzó en dirección -X: ${guestPlayer.position.x}`);
});

test('cambiar de jugador en multijugador conmuta al compañero del equipo correspondiente', () => {
  const host = fixture(true).m;
  const oldHost = host.active;
  host.switchPlayer(0);
  assert.notEqual(host.active, oldHost);
  assert.equal(host.active.team, 0);

  const oldGuest = host.guestActive;
  host.switchGuestPlayer();
  assert.notEqual(host.guestActive, oldGuest);
  assert.equal(host.guestActive.team, 1);
});

test('el generador de salas produce códigos válidos de 4 caracteres', () => {
  const mp = new MultiplayerManager();
  const code = mp.generateRoomCode();
  assert.equal(code.length, 4);
  assert.match(code, /^[2-9A-Z]{4}$/);
});
