import type { Server, Socket } from 'socket.io';
import type { Ack, JoinPayload } from '../types.js';
import { joinRoomSchema } from '../validation.js';
import {
  clearMembership,
  createEmptyRoom,
  createRoomId,
  deleteRoom,
  getMembership,
  getRoom,
  getRoomState,
  getSlotKey,
  setMembership,
  setRoom,
} from '../rooms/store.js';

function emitRoomState(io: Server, roomId: string) {
  io.to(roomId).emit('room-state', getRoomState(roomId));
}

export function leaveCurrentRoom(io: Server, socket: Socket) {
  const current = getMembership(socket.id);
  if (!current) return;

  const { roomId, role } = current;
  const room = getRoom(roomId);

  if (room) {
    const slotKey = getSlotKey(role);
    if (room[slotKey] === socket.id) {
      delete room[slotKey];
    }

    // Keep empty rooms so paired devices can reconnect with the same code.
    setRoom(roomId, room);
    socket.to(roomId).emit('peer-left', { role, socketId: socket.id });
    emitRoomState(io, roomId);
  }

  socket.leave(roomId);
  clearMembership(socket.id);
  console.log(`User ${socket.id} left ${roomId} as ${role}`);
}

export function registerRoomHandlers(io: Server, socket: Socket) {
  /** Parent starts a session; server issues a short room code. */
  socket.on('create-room', (ack?: Ack) => {
    leaveCurrentRoom(io, socket);

    const roomId = createRoomId();
    setRoom(roomId, { parentSocketId: socket.id, createdAt: Date.now() });
    setMembership(socket.id, { roomId, role: 'parent' });
    socket.join(roomId);

    const result = {
      ok: true as const,
      roomId,
      role: 'parent' as const,
      room: getRoomState(roomId),
    };

    console.log(`User ${socket.id} created room ${roomId} as parent`);
    socket.emit('join-ok', result);
    emitRoomState(io, roomId);
    ack?.(result);
  });

  /** Puppy or parent joins an existing room by code. */
  socket.on('join-room', (payload: JoinPayload, ack?: Ack) => {
    const parsed = joinRoomSchema.safeParse(payload);
    if (!parsed.success) {
      const error = {
        ok: false as const,
        error: parsed.error.issues[0]?.message || 'invalid join-room payload',
      };
      socket.emit('join-error', error);
      ack?.(error);
      return;
    }

    const roomId = parsed.data.roomId.toLowerCase();
    const role = parsed.data.role;

    leaveCurrentRoom(io, socket);

    // Recreate room if server restarted or room was destroyed elsewhere —
    // paired devices keep the same code in localStorage.
    let room = getRoom(roomId);
    if (!room) {
      room = createEmptyRoom(roomId).room;
    }

    const slotKey = getSlotKey(role);
    const existing = room[slotKey];

    if (existing && existing !== socket.id) {
      const stillConnected = io.sockets.sockets.has(existing);

      // New parent device replaces the previous parent (wife's phone, etc.).
      if (stillConnected && role === 'parent') {
        const old = io.sockets.sockets.get(existing);
        if (old) {
          old.emit('replaced', { roomId });
          old.leave(roomId);
          clearMembership(old.id);
        }
        delete room[slotKey];
      } else if (stillConnected) {
        const error = {
          ok: false as const,
          error: `${role} slot already taken in room ${roomId}`,
        };
        socket.emit('join-error', error);
        ack?.(error);
        return;
      } else {
        // Stale socket id after a hard close — reclaim the seat.
        delete room[slotKey];
      }
    }

    room[slotKey] = socket.id;
    setRoom(roomId, room);
    setMembership(socket.id, { roomId, role });
    socket.join(roomId);

    const result = {
      ok: true as const,
      roomId,
      role,
      room: getRoomState(roomId),
    };

    console.log(`User ${socket.id} joined ${roomId} as ${role}`);
    socket.emit('join-ok', result);
    socket.to(roomId).emit('peer-joined', { role, socketId: socket.id });
    emitRoomState(io, roomId);
    ack?.(result);
  });

  socket.on('destroy-room', (ack?: Ack) => {
    const current = getMembership(socket.id);
    if (!current) {
      const error = { ok: false as const, error: 'not in a room' };
      ack?.(error);
      return;
    }

    const { roomId } = current;
    io.to(roomId).emit('webrtc:hangup', {});
    io.to(roomId).emit('room-destroyed', { roomId });

    for (const id of [...(io.sockets.adapter.rooms.get(roomId) ?? [])]) {
      const peer = io.sockets.sockets.get(id);
      if (peer) {
        peer.leave(roomId);
        clearMembership(peer.id);
      }
    }

    deleteRoom(roomId);
    console.log(`Room ${roomId} destroyed by ${socket.id}`);
    ack?.({
      ok: true,
      roomId,
      role: current.role,
      room: { roomId, puppy: false, parent: false, ready: false },
    });
  });

  socket.on('leave-room', () => {
    leaveCurrentRoom(io, socket);
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(io, socket);
    console.log('Client Disconnected:', socket.id);
  });
}

/** Used by REST to pre-create a room code without a socket parent yet. */
export function createRoomViaApi(): { roomId: string } {
  const { roomId } = createEmptyRoom();
  return { roomId };
}
