import { createClient } from '@supabase/supabase-js';

const url = import.meta.env?.VITE_SUPABASE_URL;
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

const SESSION_KEY = 'fc-autism-session';

async function call(fn, args) {
  if (!supabase) throw new Error('Supabase no está configurado (falta .env)');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(translate(error.message));
  return data && data.length ? data[0] : null;
}

function translate(msg) {
  if (/ya está en uso/i.test(msg)) return 'Ese nombre ya está en uso';
  if (/incorrectos/i.test(msg)) return 'Nombre o contraseña incorrectos';
  if (/2 caracteres/i.test(msg)) return 'El nombre debe tener al menos 2 caracteres';
  if (/no es válida/i.test(msg)) return 'La sesión ha caducado, inicia sesión de nuevo';
  return msg;
}

// Hash determinista en el navegador: el nombre hace de "sal" (único por jugador).
async function hashPassword(username, password) {
  const data = new TextEncoder().encode(`${username.trim().toLowerCase()}::${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const auth = {
  session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
  },
  save(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); },
  clear() { localStorage.removeItem(SESSION_KEY); },

  async register(username, password) {
    const hash = await hashPassword(username, password);
    return call('register_player', { p_username: username, p_password_hash: hash });
  },
  async login(username, password) {
    const hash = await hashPassword(username, password);
    return call('login_player', { p_username: username, p_password_hash: hash });
  },
  async whoami(token) {
    const { data, error } = await supabase.rpc('whoami', { p_token: token });
    if (error || !data || !data.length) return null;
    return data[0];
  }
};

export const rooms = {
  async create(token, code, config) {
    return call('create_room', { p_token: token, p_code: code, p_config: config });
  },
  async get(code) {
    return call('get_room', { p_code: code });
  }
};
