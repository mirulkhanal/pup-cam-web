import type { Server } from 'socket.io';
import { env } from '../config.js';

/**
 * Reject socket handshakes that don't present the shared AUTH_TOKEN
 * (when REQUIRE_AUTH / AUTH_TOKEN is enabled).
 *
 * Client connects with: io(url, { auth: { token: '...' } })
 */
export function registerSocketAuth(io: Server) {
  io.use((socket, next) => {
    if (!env.requireAuth) {
      next();
      return;
    }

    const token = socket.handshake.auth?.token;
    if (typeof token === 'string' && token === env.authToken) {
      next();
      return;
    }

    next(new Error('unauthorized'));
  });
}
