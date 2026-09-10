/**
 * Manual Socket.IO test client for pup-cam.
 *
 * Usage (server must already be running):
 *   pnpm test:client create
 *   pnpm test:client join <roomId> puppy
 *   pnpm test:client join <roomId> parent
 *
 * With auth:
 *   AUTH_TOKEN=secret pnpm test:client create
 */
import { config } from 'dotenv';
import { io, type Socket } from 'socket.io-client';

config();

const SERVER_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3001}`;
const AUTH_TOKEN = (process.env.AUTH_TOKEN || '').trim();
const mode = process.argv[2] || 'create';
const roomIdArg = process.argv[3];
const roleArg = process.argv[4] as 'puppy' | 'parent' | undefined;

const socket: Socket = io(SERVER_URL, {
  transports: ['websocket'],
  auth: AUTH_TOKEN ? { token: AUTH_TOKEN } : undefined,
});

function attachListeners() {
  for (const event of [
    'join-ok',
    'join-error',
    'room-state',
    'peer-joined',
    'peer-left',
    'webrtc:offer',
    'webrtc:answer',
    'webrtc:ice',
    'webrtc:hangup',
    'webrtc:error',
  ]) {
    socket.on(event, (data) => console.log(`${event}:`, data));
  }
}

attachListeners();

socket.on('connect', () => {
  console.log(`connected as ${socket.id} → ${SERVER_URL}`);

  if (mode === 'create') {
    console.log('creating room as parent…');
    socket.emit('create-room', (result: unknown) => console.log('ack:', result));
    return;
  }

  if (mode === 'join') {
    if (!roomIdArg || (roleArg !== 'puppy' && roleArg !== 'parent')) {
      console.error('Usage: pnpm test:client join <roomId> <puppy|parent>');
      socket.disconnect();
      process.exit(1);
    }

    console.log(`joining room "${roomIdArg}" as ${roleArg}…`);
    socket.emit('join-room', { roomId: roomIdArg, role: roleArg }, (result: unknown) => {
      console.log('ack:', result);
    });
    return;
  }

  console.error('Usage:\n  pnpm test:client create\n  pnpm test:client join <roomId> <puppy|parent>');
  socket.disconnect();
  process.exit(1);
});

socket.on('disconnect', (reason) => console.log('disconnected:', reason));
socket.on('connect_error', (err) => console.error('connect_error:', err.message));

process.on('SIGINT', () => {
  socket.disconnect();
  process.exit(0);
});
