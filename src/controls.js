// Configuración de controles por usuario, persistida en localStorage.
// Cada acción mapea a una lista de teclas (códigos KeyboardEvent.code).
export const CONTROL_LABELS = {
  moveUp: 'Moverse arriba',
  moveDown: 'Moverse abajo',
  moveLeft: 'Moverse izquierda',
  moveRight: 'Moverse derecha',
  sprint: 'Sprint',
  pass: 'Pase corto',
  through: 'Pase filtrado',
  cross: 'Centro elevado',
  shot: 'Tiro a portería',
  switchPlayer: 'Cambiar jugador',
  skillSombrero: 'Sombrerito',
  skillElastica: 'Elástica',
  tackle: 'Entrada / robar',
  slideTackle: 'Barrida',
  curveLeft: 'Curva izquierda',
  curveRight: 'Curva derecha',
  camera: 'Cambiar cámara',
  pause: 'Pausa',
  start: 'Empezar partido'
};

export const DEFAULT_CONTROLS = {
  moveUp: ['KeyW', 'ArrowUp'],
  moveDown: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  pass: ['KeyJ'],
  through: ['KeyK'],
  cross: ['KeyL'],
  shot: ['Space'],
  switchPlayer: ['KeyC'],
  skillSombrero: ['KeyR'],
  skillElastica: ['KeyF'],
  tackle: ['KeyV'],
  slideTackle: ['KeyX'],
  curveLeft: ['KeyQ'],
  curveRight: ['KeyE'],
  camera: ['KeyB'],
  pause: ['Escape'],
  start: ['Enter']
};

// Acciones que cargan potencia y se sueltan para golpear (no se ejecutan al pulsar).
export const KICK_ACTIONS = new Set(['pass', 'through', 'cross', 'shot']);

const STORAGE_KEY = 'estadio-controls';

export function normalize(raw) {
  const out = {};
  for (const action of Object.keys(DEFAULT_CONTROLS)) {
    const val = raw && raw[action];
    out[action] = Array.isArray(val) && val.length
      ? val.filter(c => typeof c === 'string')
      : [...DEFAULT_CONTROLS[action]];
  }
  return out;
}

// Singleton vivo: se muta al reasignar y se lee en cada evento de teclado.
export const controls = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return normalize(saved);
  } catch {
    return normalize(null);
  }
})();

export function saveControls() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(controls)); } catch {}
}

export function resetControls() {
  for (const action of Object.keys(DEFAULT_CONTROLS)) {
    controls[action] = [...DEFAULT_CONTROLS[action]];
  }
  saveControls();
}

export function resetControl(action) {
  if (DEFAULT_CONTROLS[action]) controls[action] = [...DEFAULT_CONTROLS[action]];
  saveControls();
}

export function setControl(action, codes) {
  controls[action] = Array.isArray(codes) ? codes.filter(c => typeof c === 'string') : [codes];
  saveControls();
}

const KEY_LABELS = {
  Space: 'ESPACIO', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', Escape: 'ESC', Enter: 'ENTER', Tab: 'TAB',
  Backspace: 'RETROCESO', Delete: 'SUPR', ControlLeft: 'CTRL', ControlRight: 'CTRL',
  AltLeft: 'ALT', AltRight: 'ALT', MetaLeft: 'WIN', MetaRight: 'WIN'
};

export function keyLabel(code) {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

// Devuelve el nombre de la acción ligada a un código (primera coincidencia).
export function actionForCode(code) {
  for (const [action, codes] of Object.entries(controls)) {
    if (codes.includes(code)) return action;
  }
  return null;
}
