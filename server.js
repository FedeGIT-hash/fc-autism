import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';

const PORT = process.env.PORT || 3000;

// Simple HTTP health check server for Render / Railway
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify({
    name: 'FC AUTISM Multiplayer Server',
    version: '1.0.0',
    rooms: rooms.size,
    status: 'online'
  }));
});

const wss = new WebSocketServer({ server });
const rooms = new Map(); // roomCode -> { host: ws, guest: ws }

wss.on('connection', ws => {
  let currentRoom = null;
  let isHost = false;

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === 'create_room') {
        currentRoom = msg.room;
        isHost = true;
        rooms.set(currentRoom, { host: ws, guest: null });
        ws.send(JSON.stringify({ type: 'room_created', room: currentRoom }));
      } else if (msg.type === 'join_room') {
        currentRoom = msg.room;
        isHost = false;
        const room = rooms.get(currentRoom);

        if (!room) {
          ws.send(JSON.stringify({ type: 'room_error', message: 'La sala no existe o ha expirado.' }));
          return;
        }
        if (room.guest) {
          ws.send(JSON.stringify({ type: 'room_error', message: 'La sala ya está llena.' }));
          return;
        }

        room.guest = ws;
        ws.send(JSON.stringify({ type: 'peer_joined', room: currentRoom, isHost: false }));
        if (room.host.readyState === WebSocket.OPEN) {
          room.host.send(JSON.stringify({ type: 'peer_joined', room: currentRoom, isHost: true }));
        }
      } else if (msg.type === 'relay') {
        const room = rooms.get(msg.room || currentRoom);
        if (room) {
          const target = isHost ? room.guest : room.host;
          if (target && target.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify(msg.data));
          }
        }
      }
    } catch (e) {
      console.error('Error handling message', e);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      const other = isHost ? room.guest : room.host;
      if (other && other.readyState === WebSocket.OPEN) {
        other.send(JSON.stringify({ type: 'peer_left' }));
      }
      rooms.delete(currentRoom);
    }
  });
});

server.listen(PORT, () => {
  console.log(`FC AUTISM Multiplayer Server listening on port ${PORT}`);
});
