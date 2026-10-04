import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service';
import { UserDTO } from '@omnidrive/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserDTO;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  let token = req.cookies.session_token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication session required',
      },
    });
  }

  const user = await authService.verifySession(token);
  if (!user) {
    reply.clearCookie('session_token');
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired session',
      },
    });
  }

  req.user = user;
}
