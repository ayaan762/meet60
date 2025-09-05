# Meet60 — 2‑party WebRTC with 60 fps screen share

This is a minimal Google‑Meet‑like starter you can run locally or deploy. It supports:
- P2P calls for **two participants**
- **Simultaneous** camera+mic publishing
- **60 fps screen sharing**
- Mic/cam toggles
- TURN/STUN via `.env`

> For more than 2 people or recording, use an SFU (e.g., LiveKit).

## Quick Start

### 1) Signaling server
```bash
cd server
cp .env.example .env    # optional, default is fine
npm i
npm run dev             # starts ws://localhost:3001
```

### 2) Client (React + Vite)
```bash
cd client
cp .env.example .env
# Edit VITE_SIGNALING_URL if your server runs elsewhere
npm i
npm run dev             # open http://localhost:5173
```

Open the UI in **two browser windows** (or two machines), use the same **Room ID**, and click **Join Room**.

## TURN (Highly Recommended)
Without TURN, corporate NATs can fail. If you have a coturn server, fill these in `client/.env`:
```
VITE_TURN_URL=turn:YOUR_TURN_IP:3478
VITE_TURN_USERNAME=YOUR_USER
VITE_TURN_CREDENTIAL=YOUR_PASS
```
To verify TURN works, you can temporarily force relay by uncommenting `iceTransportPolicy: 'relay'` in `src/webrtc/peer.ts` (both peers must refresh).

## Notes
- For the highest FPS, share a **browser tab**.
- The app publishes **both camera and screen** simultaneously when sharing.
- Safari may prefer H.264; this sample doesn't do codec munging. For maximum compatibility, consider an SFU.

## Deploying
- **Server**: deploy to any Node host (Railway, Fly.io, Render, VPS). Expose port 3001.
- **Client**: `npm run build` then serve `dist/` from any static host (Vercel, Netlify, Nginx). Point `VITE_SIGNALING_URL` to your server's `ws://` or `wss://` endpoint.
