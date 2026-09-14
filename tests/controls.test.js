import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONTROLS, CONTROL_LABELS, normalize, keyLabel, KICK_ACTIONS } from '../src/controls.js';

test('cada acción tiene al menos una tecla por defecto', () => {
  for (const action of Object.keys(CONTROL_LABELS)) {
    assert.ok(Array.isArray(DEFAULT_CONTROLS[action]) && DEFAULT_CONTROLS[action].length >= 1, `Sin teclas para ${action}`);
  }
});

test('normalize conserva bindings válidos y repone los ausentes o vacíos', () => {
  const norm = normalize({ shot: ['Space'], pass: [], moveUp: ['KeyW'] });
  assert.deepEqual(norm.shot, ['Space']);
  assert.deepEqual(norm.moveUp, ['KeyW']);
  assert.deepEqual(norm.pass, DEFAULT_CONTROLS.pass);      // vacío -> defecto
  assert.deepEqual(norm.moveDown, DEFAULT_CONTROLS.moveDown); // ausente -> defecto
});

test('keyLabel devuelve etiquetas legibles para códigos especiales', () => {
  assert.equal(keyLabel('Space'), 'ESPACIO');
  assert.equal(keyLabel('KeyW'), 'W');
  assert.equal(keyLabel('ArrowUp'), '↑');
  assert.equal(keyLabel('ShiftLeft'), 'SHIFT');
  assert.equal(keyLabel('Digit5'), '5');
  assert.equal(keyLabel('Escape'), 'ESC');
});

test('las acciones de golpeo (carga/suelta) son exactamente pase, filtrado, centro y tiro', () => {
  assert.deepEqual([...KICK_ACTIONS].sort(), ['cross', 'pass', 'shot', 'through']);
});
