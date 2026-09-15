import { supabase, auth, rooms } from './supabase.js';

const MAX_PLAYERS = 4;
const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

// Anfitrión autoritativo sobre Supabase Realtime (broadcast + presence).
// Soporta de 1 a 4 jugadores humanos; cada uno controla a un jugador de campo
// (slot 0-3) del equipo que eligió (side 0 = local/host, side 1 = rival).
export class MultiplayerManager {
  constructor() {
    this.channel = null;
    this.roomCode = null;
    this.isHost = false;
    this.connected = false;
    this.localId = null;
    this.username = null;
    this.slot = -1;
    this.roster = [];                      // [{ id, username, side, slot }]
    this.remoteInputs = new Map();         // id -> { x, z, sprint, kick, skill, tackle, slideTackle }
    this.presentIds = [];
    this.missingPeerTimers = new Map();

    this.onStatus = () => {};
    this.onConnected = () => {};
    this.onMatchStart = () => {};
    this.onSnapshot = () => {};
    this.onEvent = () => {};
    this.onRoster = () => {};
    this.onOpponentDisconnect = () => {};
  }

  static generateRoomCode() { return generateRoomCode(); }

  async createRoom(config = {}) {
    this.disconnect();
    this.isHost = true;
    this.roomCode = generateRoomCode();
    const session = auth.session();
    if (!session) { this.onStatus('Inicia sesión para crear una sala', 'error'); return null; }
    this.localId = session.id;
    this.username = session.username;
    try {
      this.onStatus('Creando sala...', 'info');
      await rooms.create(session.token, this.roomCode, config);
      this.openChannel(session);
      this.onStatus(`SALA CREADA: #${this.roomCode}`, 'waiting');
      return this.roomCode;
    } catch (e) {
      this.onStatus(e.message, 'error');
      return null;
    }
  }

  async joinRoom(code, side = 1) {
    this.disconnect();
    this.isHost = false;
    this.roomCode = code.trim().toUpperCase();
    this.localSide = side;
    const session = auth.session();
    if (!session) { this.onStatus('Inicia sesión para unirte', 'error'); return; }
    this.localId = session.id;
    this.username = session.username;
    try {
      this.onStatus('Buscando sala...', 'info');
      const room = await rooms.get(this.roomCode);
      if (!room) { this.onStatus('La sala no existe o ha expirado', 'error'); return; }
      this.openChannel(session);
    } catch (e) {
      this.onStatus(e.message, 'error');
    }
  }

  openChannel(session) {
    this.channel = supabase.channel(`room:${this.roomCode}`, {
      config: { broadcast: { self: false }, presence: { key: session.id } }
    });

    this.channel
      .on('presence', { event: 'sync' }, () => this.handlePresence())
      .on('broadcast', { event: 'roster' }, ({ payload }) => this.receiveRoster(payload))
      .on('broadcast', { event: 'start_match' }, ({ payload }) => this.handleStartMatch(payload))
      .on('broadcast', { event: 'input' }, ({ payload }) => this.handleInput(payload))
      .on('broadcast', { event: 'snapshot' }, ({ payload }) => this.handleSnapshot(payload))
      .on('broadcast', { event: 'event' }, ({ payload }) => this.handleEvent(payload))
      .subscribe(async status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.onStatus('CONEXIÓN INESTABLE · RECONECTANDO...', 'waiting');
          return;
        }
        if (status !== 'SUBSCRIBED') return;
        await this.channel.track({
          id: this.localId,
          username: this.username,
          side: this.isHost ? 0 : this.localSide,
          host: this.isHost,
          joinedAt: Date.now()
        });
      });
  }

  /* ----------------- Presence / roster ----------------- */

  computeRoster() {
    const state = this.channel ? this.channel.presenceState() : {};
    const players = [];
    for (const key of Object.keys(state)) {
      const metas = state[key] || [];
      if (metas[0]) players.push(metas[0]);
    }
    players.sort((a, b) => (a.host ? 0 : 1) - (b.host ? 0 : 1) || (a.joinedAt || 0) - (b.joinedAt || 0));

    const slots = { 0: 0, 1: 0 };
    const roster = [];
    for (const p of players) {
      if (roster.length >= MAX_PLAYERS) break;
      const side = p.host ? 0 : (p.side === 0 ? 0 : 1);
      const slot = slots[side]++;
      roster.push({ id: p.id, username: p.username, side, slot });
    }
    return roster;
  }

  handlePresence() {
    const state = this.channel ? this.channel.presenceState() : {};
    const ids = new Set();
    for (const key of Object.keys(state)) {
      const metas = state[key] || [];
      if (metas[0]) ids.add(metas[0].id);
    }
    const prev = new Set(this.presentIds);
    this.presentIds = [...ids];

    for (const id of ids) {
      const timer = this.missingPeerTimers.get(id);
      if (timer) { clearTimeout(timer); this.missingPeerTimers.delete(id); }
    }
    if (this.connected) for (const id of prev) {
      if (ids.has(id) || id === this.localId || this.missingPeerTimers.has(id)) continue;
      const timer = setTimeout(() => {
        this.missingPeerTimers.delete(id);
        if (!this.presentIds.includes(id)) {
          this.roster = this.roster.filter(p => p.id !== id);
          this.remoteInputs.delete(id);
          if (this.isHost && this.channel) this.channel.send({ type: 'broadcast', event: 'roster', payload: { roster: this.roster } });
          this.onRoster(this.roster);
          this.onOpponentDisconnect(id);
        }
      }, 10000);
      this.missingPeerTimers.set(id, timer);
    }

    if (this.isHost) {
      const roster = this.computeRoster();
      // Keep a player visible while their connection is inside the grace
      // window; a transient Presence sync must not eject them from the match.
      for (const id of this.missingPeerTimers.keys()) {
        const previous = this.roster.find(p => p.id === id);
        if (previous && !roster.some(p => p.id === id)) roster.push(previous);
      }
      this.roster = roster;
      const me = roster.find(p => p.id === this.localId);
      if (me) this.slot = me.slot;
      this.onRoster(roster);
      this.channel.send({ type: 'broadcast', event: 'roster', payload: { roster } });
      if (!this.connected && me) {
        this.connected = true;
        this.onStatus('SALA CREADA · ESPERANDO JUGADORES', 'waiting');
        this.onConnected({ isHost: true, roomCode: this.roomCode, roster });
      }
    }
  }

  receiveRoster(payload) {
    const roster = payload.roster || [];
    this.roster = roster;
    const me = roster.find(p => p.id === this.localId);
    if (me) this.slot = me.slot;
    this.onRoster(roster);
    if (!this.connected && me) {
      this.connected = true;
      this.onStatus('Conectado a la sala', 'ready');
      this.onConnected({ isHost: this.isHost, roomCode: this.roomCode, roster });
    }
  }

  startMatch(config) {
    if (!this.isHost || !this.connected) return;
    this.channel.send({ type: 'broadcast', event: 'start_match', payload: { config, roster: this.roster } });
    this.onMatchStart(config, this.roster);
  }

  handleStartMatch(payload) {
    this.onMatchStart(payload.config, payload.roster || this.roster);
  }

  /* ----------------- Mensajería del partido ----------------- */

  sendInput(input) {
    if (!this.connected || this.isHost) return;
    this.channel.send({ type: 'broadcast', event: 'input', payload: { id: this.localId, input } });
  }

  sendSnapshot(snapshot) {
    if (!this.isHost || !this.connected) return;
    this.channel.send({ type: 'broadcast', event: 'snapshot', payload: snapshot });
  }

  sendEvent(event) {
    if (!this.isHost || !this.connected) return;
    this.channel.send({ type: 'broadcast', event: 'event', payload: event });
  }

  handleInput(payload) {
    if (!this.isHost || !payload || !payload.id) return;
    const input = payload.input || {};
    const ri = this.remoteInputs.get(payload.id) || {};
    ri.updatedAt = Date.now();
    if (input.x !== undefined) ri.x = input.x;
    if (input.z !== undefined) ri.z = input.z;
    if (input.sprint !== undefined) ri.sprint = input.sprint;
    if (input.kick) ri.kick = input.kick;
    if (input.skill) ri.skill = input.skill;
    if (input.tackle) ri.tackle = true;
    if (input.slideTackle) ri.slideTackle = true;
    if (input.switchPlayer) ri.switchPlayer = true;
    this.remoteInputs.set(payload.id, ri);
  }

  handleSnapshot(payload) {
    if (!this.isHost && payload) this.onSnapshot(payload);
  }

  handleEvent(payload) {
    if (payload) this.onEvent(payload);
  }

  disconnect() {
    this.connected = false;
    if (this.channel) {
      try { this.channel.untrack(); } catch {}
      try { supabase.removeChannel(this.channel); } catch {}
      this.channel = null;
    }
    this.roomCode = null;
    this.roster = [];
    this.remoteInputs.clear();
    this.presentIds = [];
    for (const timer of this.missingPeerTimers.values()) clearTimeout(timer);
    this.missingPeerTimers.clear();
    this.isHost = false;
    this.slot = -1;
  }
}
