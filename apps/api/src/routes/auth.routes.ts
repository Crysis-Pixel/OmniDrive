import { FastifyInstance } from 'fastify';
import { google } from 'googleapis';
import crypto from 'crypto';
import { registerSchema, loginSchema, updateSettingsSchema } from '@omnidrive/shared';
import { authService } from '../services/auth.service';
import { requireAuth } from '../middleware/auth.middleware';
import { db } from '../db';
import { config } from '../config';
import { oauthStates, getOAuthRedirectUri } from './accounts.routes';

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/register
  fastify.post('/register', async (req, reply) => {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.errors,
        },
      });
    }

    try {
      const user = await authService.register(parseResult.data);
      const token = authService.generateSessionToken(user.id, user.email);

      reply.setCookie('session_token', token, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return { user, token };
    } catch (err: any) {
      return reply.status(400).send({
        error: {
          code: 'REGISTER_FAILED',
          message: err.message || 'Registration failed',
        },
      });
    }
  });

  // POST /api/auth/login
  fastify.post('/login', async (req, reply) => {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
        },
      });
    }

    try {
      const { user, token } = await authService.login(parseResult.data);

      reply.setCookie('session_token', token, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      return { user, token };
    } catch (err: any) {
      return reply.status(401).send({
        error: {
          code: 'AUTH_FAILED',
          message: err.message || 'Invalid credentials',
        },
      });
    }
  });

  // POST /api/auth/logout
  fastify.post('/logout', async (req, reply) => {
    reply.clearCookie('session_token', { path: '/' });
    return { success: true };
  });

  // GET /api/auth/me
  fastify.get('/me', { preHandler: [requireAuth] }, async (req) => {
    return { user: req.user };
  });

  // PATCH /api/auth/settings
  fastify.patch('/settings', { preHandler: [requireAuth] }, async (req, reply) => {
    const parseResult = updateSettingsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
        },
      });
    }

    const { uploadStrategy, accountPriority } = parseResult.data;
    const updated = await db.userSettings.upsert({
      where: { userId: req.user!.id },
      create: {
        userId: req.user!.id,
        uploadStrategy: uploadStrategy || 'most_free',
        accountPriority: accountPriority || [],
      },
      update: {
        ...(uploadStrategy ? { uploadStrategy } : {}),
        ...(accountPriority ? { accountPriority } : {}),
      },
    });

    return { settings: updated };
  });

  // GET /api/auth/google - Initiate Google Sign-In / Sign-Up
  fastify.get('/google', async (req) => {
    if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
      return {
        url: null,
        isConfigured: false,
        message: 'Google Cloud Client credentials not configured in .env',
      };
    }

    const redirectUri = getOAuthRedirectUri(req);
    const oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const state = `login_${crypto.randomBytes(24).toString('hex')}`;
    oauthStates.set(state, { isLogin: true, redirectUri, timestamp: Date.now() });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: config.GOOGLE_SCOPES,
      state,
    });

    return {
      url: authUrl,
      isConfigured: true,
    };
  });
}
