import type { Server, Socket } from 'socket.io';
import type { Ack } from '../types.js';
import { getMembership, getPeerSocketId } from '../rooms/store.js';
import { webRtcIceSchema, webRtcSdpSchema } from '../validation.js';

type RelayAck = Ack<{ ok: true } | { ok: false; error: string }>;

function relayToPeer(
  io: Server,
  socket: Socket,
  event: string,
  payload: Record<string, unknown>,
  ack?: RelayAck,
) {
  const membership = getMembership(socket.id);
  if (!membership) {
    const error = { ok: false as const, error: 'join a room before sending WebRTC signals' };
    socket.emit('webrtc:error', error);
    ack?.(error);
    return;
  }

  const peerId = getPeerSocketId(membership.roomId, membership.role);
  if (!peerId) {
    const error = { ok: false as const, error: 'peer is not connected yet' };
    socket.emit('webrtc:error', error);
    ack?.(error);
    return;
  }

  io.to(peerId).emit(event, {
    ...payload,
    from: membership.role,
    roomId: membership.roomId,
  });

  ack?.({ ok: true });
}

/**
 * The server never touches camera/mic data.
 * It only forwards WebRTC setup messages between puppy and parent.
 */
export function registerWebRtcHandlers(io: Server, socket: Socket) {
  socket.on('webrtc:offer', (payload: unknown, ack?: RelayAck) => {
    const parsed = webRtcSdpSchema.safeParse(payload);
    if (!parsed.success || parsed.data.sdp == null) {
      const error = { ok: false as const, error: 'sdp is required' };
      socket.emit('webrtc:error', error);
      ack?.(error);
      return;
    }
    relayToPeer(io, socket, 'webrtc:offer', { sdp: parsed.data.sdp }, ack);
  });

  socket.on('webrtc:answer', (payload: unknown, ack?: RelayAck) => {
    const parsed = webRtcSdpSchema.safeParse(payload);
    if (!parsed.success || parsed.data.sdp == null) {
      const error = { ok: false as const, error: 'sdp is required' };
      socket.emit('webrtc:error', error);
      ack?.(error);
      return;
    }
    relayToPeer(io, socket, 'webrtc:answer', { sdp: parsed.data.sdp }, ack);
  });

  socket.on('webrtc:ice', (payload: unknown, ack?: RelayAck) => {
    const parsed = webRtcIceSchema.safeParse(payload);
    if (!parsed.success || parsed.data.candidate === undefined) {
      const error = { ok: false as const, error: 'candidate is required' };
      socket.emit('webrtc:error', error);
      ack?.(error);
      return;
    }
    relayToPeer(io, socket, 'webrtc:ice', { candidate: parsed.data.candidate }, ack);
  });

  socket.on('webrtc:hangup', (_payload?: unknown, ack?: RelayAck) => {
    relayToPeer(io, socket, 'webrtc:hangup', {}, ack);
  });
}
