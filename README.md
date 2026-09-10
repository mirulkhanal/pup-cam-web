# Pup Cam — local puppy monitor (backend)

Self-hosted signaling server for a puppy/parent WebRTC session.
Video and audio go **peer-to-peer**; this server only handles rooms + WebRTC setup messages.

## Quick start (dev)

```bash
# from repo root — starts API + Vite together
pnpm install
pnpm dev
```

- App: `https://localhost:5173` (desktop) or `https://<your-machine>:5173` (phone)
- API is reached through the Vite HTTPS proxy (no separate URL needed on the phone)

Make sure `client/.env` looks like:

```env
VITE_SERVER_URL=
VITE_API_PROXY=http://127.0.0.1:3002
```

**Phone note:** camera/mic only work on HTTPS. Restart `pnpm dev`, open `https://<tailscale-or-lan-name>:5173`, accept the certificate warning, then join. Plain `http://` on a phone will crash with `getUserMedia` undefined.

### How to use

1. On the **PC** (puppy camera): open the site → **This PC is the puppy camera** → allow camera/mic  
2. On your **phone** (parent): open the same Tailscale HTTPS URL → **This phone watches (parent)**  
3. No room codes — everyone joins the same house session (`home`)  
4. Parent: **Hold to talk** (mic permission is asked only then)

Another phone (e.g. spouse) can open parent view too — it replaces the previous parent viewer.

### Server only / client only

```bash
pnpm dev:server
pnpm dev:client
```

Check API:

```bash
curl http://localhost:3002/health
curl http://localhost:3002/api/config
```

## Socket events

| Direction | Event | Purpose |
|-----------|--------|---------|
| C→S | `create-room` | Parent creates session, gets `roomId` |
| C→S | `join-room` `{ roomId, role }` | Join as `puppy` or `parent` |
| C→S | `leave-room` | Leave session |
| S→C | `join-ok` / `join-error` | Join result |
| S→C | `room-state` | `{ puppy, parent, ready }` |
| S→C | `peer-joined` / `peer-left` | Presence |
| C→S→C | `webrtc:offer` / `answer` / `ice` | Relay SDP/ICE to peer |
| C→S→C | `webrtc:hangup` | Peer ended call |
| S→C | `webrtc:error` | Relay failed |

Auth (when `AUTH_TOKEN` set):

```js
io(url, { auth: { token: process.env.AUTH_TOKEN } })
```

## REST

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | Liveness |
| GET | `/api/config` | `iceServers` for WebRTC |
| POST | `/api/rooms` | Create room code (auth if enabled) |
| GET | `/api/rooms/:id` | Room presence |
| GET | `/api/rooms` | List rooms |

## Manual socket test

```bash
cd server
pnpm test:client create
# other terminal:
pnpm test:client join <roomId> puppy
```

## Docker

From repo root:

```bash
# set AUTH_TOKEN in server/.env first
docker compose up --build
```

Reach it on your Tailscale IP / MagicDNS, e.g. `http://pup-cam:3001`.

## What this backend does / does not do

**Does:** rooms, roles, presence, auth token, ICE config, WebRTC signaling relay.

**Does not:** record video, process audio, push notifications, or host the React UI (next step).
