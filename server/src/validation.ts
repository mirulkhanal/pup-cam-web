import { z } from 'zod';

export const joinRoomSchema = z.object({
  roomId: z.string().trim().min(1).max(32),
  role: z.enum(['puppy', 'parent']),
});

export const webRtcSdpSchema = z.object({
  sdp: z.unknown(),
});

export const webRtcIceSchema = z.object({
  candidate: z.unknown(),
});
