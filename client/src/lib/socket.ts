import { io, type Socket } from 'socket.io-client';
import { clientConfig } from '../config';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(clientConfig.serverUrl, {
      autoConnect: false,
      transports: ['websocket'],
      auth: clientConfig.authToken ? { token: clientConfig.authToken } : undefined,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
