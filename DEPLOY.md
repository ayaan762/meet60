# Deploy Guide (Vercel + Fly.io + Docker)

## Option A — Everything with Docker Compose (local/VPS)
```bash
docker compose up --build
# server -> ws://localhost:3001
# turn   -> turn:localhost:3478  (user: meet60 / pass: secret123)
```
Then set in `client/.env`:
```
VITE_SIGNALING_URL=ws://localhost:3001
VITE_TURN_URL=turn:localhost:3478
VITE_TURN_USERNAME=meet60
VITE_TURN_CREDENTIAL=secret123
```
Run client locally:
```bash
cd client && npm i && npm run dev
```

## Option B — Client on Vercel, Server on Fly.io
1) **Server (Fly.io)**
   - Install flyctl, then:
   ```bash
   fly launch --copy-config --no-deploy   # edit app name in fly.toml
   fly deploy
   ```
   - Note the URL (e.g., `https://meet60-server-yourname.fly.dev`). Convert to **WS**: `wss://meet60-server-yourname.fly.dev`

2) **Client (Vercel)**
   - In `client/.env` set:
   ```
   VITE_SIGNALING_URL=wss://meet60-server-yourname.fly.dev
   VITE_STUN_URL=stun:stun.l.google.com:19302
   # If you deployed TURN, set it here as well
   ```
   - `npm run build` then deploy the `client/` folder to Vercel (or use Vercel CLI).

## Security Notes
- Change TURN `user`/`password` and add TLS (5349) in production.
- Restrict `ALLOWED_ORIGINS` in the server `.env` to your real client origins.
- Consider moving to an **SFU** if you need >2 participants or adaptive bandwidth/recording.
