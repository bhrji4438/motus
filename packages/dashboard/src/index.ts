import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { RbacGuard } from '@/auth/RbacGuard.js';
import { defaultAnalytics } from '@/api/analytics/AnalyticsService.js';
import { defaultAuditLog } from '@/api/audit/AuditLogService.js';
import { defaultSessionInspector } from '@/api/sessions/SessionInspector.js';
import { defaultDispatchMonitor } from '@/api/dispatch/DispatchMonitor.js';
import { defaultNotificationMonitor } from '@/api/notifications/NotificationMonitor.js';
import { defaultQueueMonitor } from '@/api/queues/QueueMonitor.js';
import { defaultRealtime } from '@/realtime/RealtimeEngine.js';

export const dashboardPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  
  // Attach the HTTP server to the realtime engine for WS upgrades
  fastify.ready((err) => {
    if (!err && fastify.server) {
      defaultRealtime.attachServer(fastify.server);
    }
  });

  // REST API Routes
  fastify.get('/api/dashboard/:tenantId/analytics', async (request: any, reply) => {
    const user = RbacGuard.authenticateRequest(request.headers);
    if (!user || !RbacGuard.authorize(user, 'analytics.read', request.params.tenantId)) {
      return reply.status(403).send({ error: 'Forbidden. Requires analyst or admin permissions.' });
    }
    const summary = await defaultAnalytics.getTenantSummary(request.params.tenantId);
    return summary;
  });

  fastify.get('/api/dashboard/:tenantId/audit', async (request: any, reply) => {
    const user = RbacGuard.authenticateRequest(request.headers);
    if (!user || !RbacGuard.authorize(user, 'logs.read', request.params.tenantId)) {
      return reply.status(403).send({ error: 'Forbidden. Requires log view permissions.' });
    }
    const logs = await defaultAuditLog.searchLogs(request.params.tenantId);
    return logs;
  });

  fastify.get('/api/dashboard/:tenantId/audit/export', async (request: any, reply) => {
    const user = RbacGuard.authenticateRequest(request.headers);
    if (!user || !RbacGuard.authorize(user, 'logs.read', request.params.tenantId)) {
      return reply.status(403).send({ error: 'Forbidden.' });
    }
    const csv = await defaultAuditLog.exportCSV(request.params.tenantId);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=audit-logs-${request.params.tenantId}.csv`);
    return csv;
  });

  fastify.get('/api/dashboard/:tenantId/sessions', async (request: any, reply) => {
    const user = RbacGuard.authenticateRequest(request.headers);
    if (!user || !RbacGuard.authorize(user, 'session.read', request.params.tenantId)) {
      return reply.status(403).send({ error: 'Forbidden.' });
    }
    const status = request.query.status;
    const sessions = await defaultSessionInspector.listSessions(request.params.tenantId, status);
    return sessions;
  });

  fastify.get('/api/dashboard/:tenantId/sessions/:sessionId', async (request: any, reply) => {
    const user = RbacGuard.authenticateRequest(request.headers);
    if (!user || !RbacGuard.authorize(user, 'session.read', request.params.tenantId)) {
      return reply.status(403).send({ error: 'Forbidden.' });
    }
    const detail = await defaultSessionInspector.getSessionDetail(request.params.tenantId, request.params.sessionId);
    if (!detail) return reply.status(404).send({ error: 'Session not found' });
    return detail;
  });

  fastify.get('/api/dashboard/:tenantId/sessions/:sessionId/traces', async (request: any, reply) => {
    const user = RbacGuard.authenticateRequest(request.headers);
    if (!user || !RbacGuard.authorize(user, 'logs.read', request.params.tenantId)) {
      return reply.status(403).send({ error: 'Forbidden.' });
    }
    const traces = await defaultSessionInspector.getSessionTraces(request.params.tenantId, request.params.sessionId);
    return traces;
  });

  fastify.get('/api/dashboard/:tenantId/drivers', async (request: any, reply) => {
    const user = RbacGuard.authenticateRequest(request.headers);
    if (!user || !RbacGuard.authorize(user, 'tenant.read', request.params.tenantId)) {
      return reply.status(403).send({ error: 'Forbidden.' });
    }
    const status = request.query.status;
    const drivers = await defaultDispatchMonitor.listDrivers(request.params.tenantId, status);
    return drivers;
  });

  fastify.get('/api/dashboard/:tenantId/queues', async (request: any, reply) => {
    const user = RbacGuard.authenticateRequest(request.headers);
    if (!user || !RbacGuard.authorize(user, 'logs.read', request.params.tenantId)) {
      return reply.status(403).send({ error: 'Forbidden.' });
    }
    const queues = await defaultQueueMonitor.getTenantQueues(request.params.tenantId);
    return queues;
  });

  fastify.get('/api/dashboard/:tenantId/notifications', async (request: any, reply) => {
    const user = RbacGuard.authenticateRequest(request.headers);
    if (!user || !RbacGuard.authorize(user, 'logs.read', request.params.tenantId)) {
      return reply.status(403).send({ error: 'Forbidden.' });
    }
    const logs = await defaultNotificationMonitor.getLogs(request.params.tenantId);
    return logs;
  });

  // Server-Sent Events (SSE) Route
  fastify.get('/api/dashboard/:tenantId/realtime/sse', async (request: any, reply) => {
    const tenantId = request.params.tenantId;

    // Send SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Write initial comment to establish stream
    reply.raw.write(': handshake ok\n\n');

    // Register SSE client connection
    const client = defaultRealtime.registerSseClient(
      tenantId,
      (data) => reply.raw.write(data),
      () => reply.raw.end()
    );

    request.raw.on('close', () => {
      defaultRealtime.removeSseClient(client);
    });
  });
};

export { RbacGuard } from '@/auth/RbacGuard.js';
export { defaultAnalytics } from '@/api/analytics/AnalyticsService.js';
export { defaultAuditLog } from '@/api/audit/AuditLogService.js';
export { defaultSessionInspector } from '@/api/sessions/SessionInspector.js';
export { defaultDispatchMonitor } from '@/api/dispatch/DispatchMonitor.js';
export { defaultNotificationMonitor } from '@/api/notifications/NotificationMonitor.js';
export { defaultQueueMonitor } from '@/api/queues/QueueMonitor.js';
export { defaultRealtime } from '@/realtime/RealtimeEngine.js';
export * from '@/types/contracts.js';
