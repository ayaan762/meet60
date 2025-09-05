import 'dotenv/config';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const PORT = process.env.PORT || 3001;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

// Rooms: roomId -> Set of client objects
const rooms = new Map();
// Clients: ws -> { id, roomId }
const clients = new Map();

function send(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch {}
}

function broadcastToRoom(roomId, obj, exceptWs = null) {
  const set = rooms.get(roomId);
  if (!set) return;
  for (const c of set) {
    if (c.ws !== exceptWs && c.ws.readyState === 1) {
      send(c.ws, obj);
    }
  }
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws, req) => {
  const origin = req.headers.origin || '';
  if (allowedOrigins.length && !allowedOrigins.includes(origin)) {
    ws.close(1008, 'Origin not allowed');
    return;
  }

  const id = randomUUID();
  clients.set(ws, { id, roomId: null, name: null });

  send(ws, { type: 'welcome', id });

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    const meta = clients.get(ws);
    if (!meta) return;

    if (msg.type === 'join') {
      const { roomId, displayName } = msg;
      meta.roomId = roomId;
      meta.name = displayName || 'Guest';
      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      rooms.get(roomId).add({ ws, id: meta.id, name: meta.name });

      // notify existing peers about the new one
      broadcastToRoom(roomId, { type: 'peer-join', peerId: meta.id, displayName: meta.name }, ws);

      // notify the new peer about existing peers
      const existing = Array.from(rooms.get(roomId))
        .filter(c => c.ws !== ws)
        .map(c => ({ peerId: c.id, displayName: c.name }));
      send(ws, { type: 'peers-in-room', peers: existing });
      return;
    }

    if (msg.type === 'leave') {
      const { roomId } = meta;
      if (roomId && rooms.has(roomId)) {
        const set = rooms.get(roomId);
        for (const c of Array.from(set)) if (c.ws === ws) set.delete(c);
        broadcastToRoom(roomId, { type: 'peer-leave', peerId: meta.id }, ws);
        meta.roomId = null;
      }
      return;
    }

    // Forward SDP/ICE to target
    if (msg.type === 'offer' || msg.type === 'answer' || msg.type === 'ice') {
      const { target, payload } = msg;
      const { roomId } = meta;
      if (!roomId || !rooms.has(roomId)) return;
      const set = rooms.get(roomId);
      for (const c of set) {
        if (c.id === target && c.ws.readyState === 1) {
          send(c.ws, { type: msg.type, from: meta.id, payload });
          break;
        }
      }
      return;
    }
  });

  ws.on('close', () => {
    const meta = clients.get(ws);
    clients.delete(ws);
    if (!meta) return;
    const { roomId } = meta;
    if (roomId && rooms.has(roomId)) {
      const set = rooms.get(roomId);
      for (const c of Array.from(set)) if (c.ws === ws) set.delete(c);
      broadcastToRoom(roomId, { type: 'peer-leave', peerId: meta.id }, ws);
      if (set.size === 0) rooms.delete(roomId);
    }
  });
});

console.log(`[meet60] Signaling server running on ws://localhost:${PORT}`);
