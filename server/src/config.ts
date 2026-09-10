import { config as loadEnv } from 'dotenv';

loadEnv();

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

export const env = {
  port: Number(process.env.PORT || 3001),
  /** Shared secret for HTTP + Socket.IO. Empty = open (local dev only). */
  authToken: (process.env.AUTH_TOKEN || '').trim(),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  /** Comma-separated STUN URLs */
  stunUrls: (process.env.STUN_URLS || 'stun:stun.l.google.com:19302')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** Optional TURN (needed sometimes even on Tailscale edge cases) */
  turnUrl: (process.env.TURN_URL || '').trim(),
  turnUsername: (process.env.TURN_USERNAME || '').trim(),
  turnCredential: (process.env.TURN_CREDENTIAL || '').trim(),
  requireAuth: bool(process.env.REQUIRE_AUTH, Boolean((process.env.AUTH_TOKEN || '').trim())),
};

export function getIceServers(): RTCIceServerLike[] {
  const servers: RTCIceServerLike[] = env.stunUrls.map((urls) => ({ urls }));

  if (env.turnUrl) {
    servers.push({
      urls: env.turnUrl,
      username: env.turnUsername || undefined,
      credential: env.turnCredential || undefined,
    });
  }

  return servers;
}

/** Shape browsers expect for RTCPeerConnection iceServers (no DOM types on server). */
export type RTCIceServerLike = {
  urls: string | string[];
  username?: string;
  credential?: string;
};
