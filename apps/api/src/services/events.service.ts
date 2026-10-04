import { FastifyReply } from 'fastify';
import { SSEEventData } from '@omnidrive/shared';

interface SSEClient {
  userId: string;
  reply: FastifyReply;
}

export class EventsService {
  private clients = new Set<SSEClient>();

  addClient(userId: string, reply: FastifyReply) {
    const client: SSEClient = { userId, reply };
    this.clients.add(client);

    // Initial connection comment
    reply.raw.write(': connected\n\n');

    // Heartbeat to keep connection alive
    const interval = setInterval(() => {
      try {
        reply.raw.write(': ping\n\n');
      } catch {
        clearInterval(interval);
        this.removeClient(client);
      }
    }, 15000);

    reply.raw.on('close', () => {
      clearInterval(interval);
      this.removeClient(client);
    });
  }

  removeClient(client: SSEClient) {
    this.clients.delete(client);
  }

  emitToUser(userId: string, data: SSEEventData) {
    const message = `event: message\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      if (client.userId === userId) {
        try {
          client.reply.raw.write(message);
        } catch {
          this.removeClient(client);
        }
      }
    }
  }

  emitAll(data: SSEEventData) {
    const message = `event: message\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.reply.raw.write(message);
      } catch {
        this.removeClient(client);
      }
    }
  }
}

export const eventsService = new EventsService();
