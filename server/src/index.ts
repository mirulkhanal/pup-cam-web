import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { env } from './config.js';
import { registerSocketHandlers } from './socket/index.js';

const app = createApp();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((s) => s.trim()),
  },
});

registerSocketHandlers(io);

if (!env.requireAuth) {
  console.warn(
    '[pup-cam] AUTH_TOKEN not set — socket/HTTP room APIs are open. Set AUTH_TOKEN for Tailscale use.',
  );
}

httpServer.listen(env.port, () => {
  console.log(`Server started on http://localhost:${env.port}`);
  console.log(`Health:  GET /health`);
  console.log(`Config:  GET /api/config`);
});
