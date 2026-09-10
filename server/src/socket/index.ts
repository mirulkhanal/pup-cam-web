import type { Server } from 'socket.io';
import { registerSocketAuth } from './auth.js';
import { registerRoomHandlers } from './roomHandlers.js';
import { registerWebRtcHandlers } from './webrtcHandlers.js';

export function registerSocketHandlers(io: Server) {
  registerSocketAuth(io);

  io.on('connection', (socket) => {
    console.log('Client Connected:', socket.id);
    registerRoomHandlers(io, socket);
    registerWebRtcHandlers(io, socket);
  });
}
