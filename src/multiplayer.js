import peerjs from 'peerjs';
const Peer = peerjs?.Peer || peerjs;

export class MultiplayerManager {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.ws = null;
    this.mode = 'webrtc'; // 'webrtc' | 'ws'
    this.isHost = false;
    this.roomCode = null;
    this.connected = false;
    this.ping = 0;
    this.pingTimer = null;
    this.remoteInput = { x: 0, z: 0, sprint: false, kick: null, skill: null, tackle: false, slideTackle: false, switchPlayer: false };

    // Callbacks
    this.onStatus = () => {};
    this.onConnected = () => {};
    this.onMatchStart = () => {};
    this.onSnapshot = () => {};
    this.onRemoteInput = () => {};
    this.onEvent = () => {};
    this.onOpponentDisconnect = () => {};
    this.onPing = () => {};
  }

  generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  createRoom(code = null, customWsUrl = null) {
    this.disconnect();
    this.isHost = true;
    this.roomCode = (code || this.generateRoomCode()).toUpperCase();

    if (customWsUrl) {
      this.mode = 'ws';
      this.connectWebSocket(customWsUrl, true);
    } else {
      this.mode = 'webrtc';
      this.connectPeerJSHost();
    }
    return this.roomCode;
  }

  joinRoom(code, customWsUrl = null) {
    this.disconnect();
    this.isHost = false;
    this.roomCode = code.trim().toUpperCase();

    if (customWsUrl) {
      this.mode = 'ws';
      this.connectWebSocket(customWsUrl, false);
    } else {
      this.mode = 'webrtc';
      this.connectPeerJSGuest();
    }
    return this.roomCode;
  }

  /* ----------------- WebRTC (PeerJS) ----------------- */
  connectPeerJSHost() {
    this.onStatus('Conectando a la red de salas...', 'info');
    const peerId = `estadio-26-${this.roomCode}`;

    try {
      this.peer = new Peer(peerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', () => {
        this.onStatus(`SALA CREADA: #${this.roomCode}`, 'waiting');
      });

      this.peer.on('connection', conn => {
        this.conn = conn;
        this.setupDataConnection();
      });

      this.peer.on('error', err => {
        if (err.type === 'unavailable-id') {
          this.roomCode = this.generateRoomCode();
          this.connectPeerJSHost();
        } else {
          this.onStatus(`Error: ${err.message || err.type}`, 'error');
        }
      });
    } catch (e) {
      this.onStatus('No se pudo inicializar WebRTC', 'error');
    }
  }

  connectPeerJSGuest() {
    this.onStatus('Buscando sala del anfitrión...', 'info');
    const targetPeerId = `estadio-26-${this.roomCode}`;

    try {
      this.peer = new Peer({
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', () => {
        const conn = this.peer.connect(targetPeerId, { reliable: true });
        this.conn = conn;
        this.setupDataConnection();
      });

      this.peer.on('error', () => {
        this.onStatus(`No se encontró la sala #${this.roomCode}`, 'error');
      });
    } catch (e) {
      this.onStatus('Error al conectar con la sala', 'error');
    }
  }

  setupDataConnection() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      this.connected = true;
      this.startPingHeartbeat();
      this.onStatus('¡Rival conectado!', 'ready');
      this.onConnected({ isHost: this.isHost, roomCode: this.roomCode });

      if (this.isHost) {
        this.send('welcome', { room: this.roomCode, host: true });
      }
    });

    this.conn.on('data', data => {
      this.handleMessage(data);
    });

    this.conn.on('close', () => {
      this.handleDisconnection();
    });

    this.conn.on('error', () => {
      this.handleDisconnection();
    });
  }

  /* ----------------- WebSocket (Render/Local) ----------------- */
  connectWebSocket(url, isHost) {
    this.onStatus(`Conectando al servidor ${url}...`, 'info');
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({
          type: isHost ? 'create_room' : 'join_room',
          room: this.roomCode
        }));
        this.onStatus(isHost ? `SALA CREADA: #${this.roomCode}` : 'Conectando a la sala...', 'waiting');
      };

      this.ws.onmessage = evt => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'peer_joined') {
            this.connected = true;
            this.startPingHeartbeat();
            this.onStatus('¡Rival conectado!', 'ready');
            this.onConnected({ isHost: this.isHost, roomCode: this.roomCode });
          } else if (msg.type === 'room_error') {
            this.onStatus(msg.message || 'Error en la sala', 'error');
          } else {
            this.handleMessage(msg);
          }
        } catch (err) {
          console.error('WS parse error', err);
        }
      };

      this.ws.onclose = () => this.handleDisconnection();
      this.ws.onerror = () => this.onStatus('Error en servidor WebSocket', 'error');
    } catch (e) {
      this.onStatus('No se pudo conectar al servidor WebSocket', 'error');
    }
  }

  /* ----------------- Message Handling ----------------- */
  send(type, payload = {}) {
    if (!this.connected) return;
    const msg = { type, ...payload };
    if (this.mode === 'webrtc' && this.conn && this.conn.open) {
      this.conn.send(msg);
    } else if (this.mode === 'ws' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'relay', room: this.roomCode, data: msg }));
    }
  }

  sendInput(input) {
    this.send('input', { input });
  }

  sendSnapshot(snapshot) {
    this.send('snap', { snap: snapshot });
  }

  sendEvent(event) {
    this.send('evt', { evt: event });
  }

  handleMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'welcome':
        if (!this.isHost) {
          this.connected = true;
          this.startPingHeartbeat();
          this.onStatus('¡Conectado al partido!', 'ready');
          this.onConnected({ isHost: false, roomCode: this.roomCode });
        }
        break;

      case 'start_match':
        this.onMatchStart(msg.config);
        break;

      case 'input':
        if (msg.input) {
          // Continuous movement fields are overwritten directly.
          const ri = this.remoteInput;
          if (msg.input.x !== undefined) ri.x = msg.input.x;
          if (msg.input.z !== undefined) ri.z = msg.input.z;
          if (msg.input.sprint !== undefined) ri.sprint = msg.input.sprint;
          // One-shot actions are edge-triggered: they arrive non-null on a single
          // frame, then every following frame sends null/false. Overwriting here
          // would erase a pending kick/skill/tackle before the host consumes it,
          // which made online shots (and skill moves/tackles) get dropped at random.
          if (msg.input.kick) ri.kick = msg.input.kick;
          if (msg.input.skill) ri.skill = msg.input.skill;
          if (msg.input.tackle) ri.tackle = true;
          if (msg.input.slideTackle) ri.slideTackle = true;
          if (msg.input.switchPlayer) {
            ri.switchPlayer = true;
            ri.newIndex = msg.input.newIndex;
          }
          this.onRemoteInput(msg.input);
        }
        break;

      case 'snap':
        if (msg.snap) {
          this.onSnapshot(msg.snap);
        }
        break;

      case 'evt':
        if (msg.evt) {
          this.onEvent(msg.evt);
        }
        break;

      case 'ping':
        this.send('pong', { time: msg.time });
        break;

      case 'pong':
        if (msg.time) {
          this.ping = Math.round(Date.now() - msg.time);
          this.onPing(this.ping);
        }
        break;
    }
  }

  startPingHeartbeat() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.connected) {
        this.send('ping', { time: Date.now() });
      }
    }, 2000);
  }

  handleDisconnection() {
    const wasConnected = this.connected;
    this.connected = false;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (wasConnected) {
      this.onStatus('El rival se ha desconectado', 'warning');
      this.onOpponentDisconnect();
    }
  }

  disconnect() {
    this.connected = false;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.conn) {
      try { this.conn.close(); } catch {}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.roomCode = null;
  }
}
