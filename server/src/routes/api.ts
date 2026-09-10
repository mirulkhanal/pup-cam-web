import { Router } from 'express';
import { getIceServers, env } from '../config.js';
import { createRoomViaApi } from '../socket/roomHandlers.js';
import { getRoom, getRoomState, listRoomIds } from '../rooms/store.js';
import { requireHttpAuth } from '../middleware/httpAuth.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/** ICE servers for the browser/React Native WebRTC client. */
apiRouter.get('/config', (_req, res) => {
  res.json({
    ok: true,
    iceServers: getIceServers(),
    authRequired: env.requireAuth,
  });
});

/** Create a room code without joining (parent can join-room afterward). */
apiRouter.post('/rooms', requireHttpAuth, (_req, res) => {
  const { roomId } = createRoomViaApi();
  res.status(201).json({ ok: true, roomId, room: getRoomState(roomId) });
});

apiRouter.get('/rooms/:roomId', requireHttpAuth, (req, res) => {
  const roomId = String(req.params.roomId || '').trim().toLowerCase();
  if (!getRoom(roomId)) {
    res.status(404).json({ ok: false, error: 'room not found' });
    return;
  }
  res.json({ ok: true, room: getRoomState(roomId) });
});

/** Dev helper — list active room ids (auth required when enabled). */
apiRouter.get('/rooms', requireHttpAuth, (_req, res) => {
  res.json({ ok: true, rooms: listRoomIds().map((roomId) => getRoomState(roomId)) });
});
