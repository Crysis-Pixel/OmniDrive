import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.middleware';
import { eventsService } from '../services/events.service';

export async function eventsRoutes(fastify: FastifyInstance) {
  // GET /api/events - Server-Sent Events stream
  fastify.get('/', { preHandler: [requireAuth] }, async (req, reply) => {
    // SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.flushHeaders();

    eventsService.addClient(req.user!.id, reply);
  });
}
