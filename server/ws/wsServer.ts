import type { Server } from 'http';
import { WebSocketServer } from 'ws';

export function createHatchinWebSocketServer(server: Server): WebSocketServer {
  return new WebSocketServer({ server, path: '/ws' });
}
