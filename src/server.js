import { createServer } from 'node:http';
import app from './http-app.js';
import { env } from './config/env.js';
import { attachRealtimeServer } from './realtime/hub.js';

const server = createServer(app);

attachRealtimeServer(server);

if (!process.env.VERCEL) {
  server.listen(env.port);
}

export default server;