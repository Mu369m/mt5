/**
 * @file backend/src/server.ts
 * @description Main Express bootloader and WebSocket telemetry server.
 * Instantiates HTTP/WS listeners, registers route namespaces, and handles database connections.
 * 
 * Connected Modules:
 * - backend/src/db.ts (initializes Prisma client connection)
 * - backend/src/routes/ (auth, admin, destinations, rules, symbols, policies, sandbox)
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';

// Load environmental variables
dotenv.config();

import { authRouter } from './routes/auth';
import { adminRouter } from './routes/admin';
import { publicRouter } from './routes/public';
import { tenantRouter } from './routes/tenant';
import { bridgeRouter } from './routes/bridge';
import { destinationsRouter } from './routes/destinations';
import { rulesRouter } from './routes/rules';
import { symbolsRouter } from './routes/symbols';
import { policiesRouter } from './routes/policies';
import { sandboxRouter } from './routes/sandbox';
import { copierRouter } from './routes/copier';
import { authenticateToken } from './middleware/auth';
import prisma from './db';
import { registerTelemetryBroadcaster } from '../../mt-bridge/src/engine';
import './jobs';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for dashboard interactions
app.use(cors());
app.use(express.json());

// 1. Unauthenticated route boundaries
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);

// 2. Authenticated route boundaries
app.use('/api/admin', authenticateToken, adminRouter);
app.use('/api/tenant', authenticateToken, tenantRouter);
app.use('/api/bridge', authenticateToken, bridgeRouter);
app.use('/api/destinations', authenticateToken, destinationsRouter);
app.use('/api/rules', authenticateToken, rulesRouter);
app.use('/api/symbols', authenticateToken, symbolsRouter);
app.use('/api/policies', authenticateToken, policiesRouter);
app.use('/api/sandbox', authenticateToken, sandboxRouter);
app.use('/api/copier', authenticateToken, copierRouter);

// Standard root diagnostics endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', timestamp: new Date() });
});

// Create HTTP Server
const server = http.createServer(app);

// Accept the dashboard and terminal endpoint paths on the same Railway listener.
const wss = new WebSocketServer({ noServer: true });
const connectedClients = new Set<WebSocket>();

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname;
  if (!['/ws', '/ws/master', '/ws/slave'].includes(pathname)) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws: WebSocket) => {
  connectedClients.add(ws);
  
  // Send welcome diagnostic ping
  ws.send(JSON.stringify({ event: 'CONNECTED', message: 'Institutional Telemetry Link Established' }));

  ws.on('close', () => {
    connectedClients.delete(ws);
  });
});

/**
 * Broadcasts trade logs or metrics in real-time to active WebSocket client dashboards.
 * 
 * @param eventName - The type of event (e.g. 'TRADE_LOG', 'LATENCY_PING')
 * @param data - The payload schema
 */
export function broadcastTelemetry(eventName: string, data: any): void {
  const payload = JSON.stringify({ event: eventName, data, timestamp: new Date() });
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Register the telemetry bridge broadcaster hook
registerTelemetryBroadcaster(broadcastTelemetry);

// Global process error bounds handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED_REJECTION] promise:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT_EXCEPTION] error:', error);
});

// Startup sequence
async function main() {
  try {
    console.log('[STARTUP] Verifying Database Connection pool...');
    await prisma.$connect();
    console.log('[STARTUP] Database connection verified.');

    server.listen(PORT, () => {
      console.log(`\n🚀 =======================================================`);
      console.log(`🔥 BRP Institutional Trade Router Server running on port ${PORT}`);
      console.log(`📡 WebSocket Telemetry Gateway mounted on same port`);
      console.log(`=======================================================\n`);
    });
  } catch (error) {
    console.error('[STARTUP_FAILED] Could not connect to the database', error);
    process.exit(1);
  }
}

// Start executing
if (process.env.NODE_ENV !== 'test') {
  main();
}

export { app, server, wss };
export default app;
