import { FastifyInstance } from 'fastify';
import { google } from 'googleapis';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.middleware';
import { db } from '../db';
import { config } from '../config';
import { encryptToken } from '../services/crypto.service';
import { syncService } from '../services/sync.service';
import { updateAccountSchema, LinkedAccountDTO } from '@omnidrive/shared';
import { invalidateDriveClient } from '../services/drive/drive.factory';

// In-memory OAuth state cache (maps state -> userId)
const oauthStates = new Map<string, { userId: string; timestamp: number }>();

export async function accountsRoutes(fastify: FastifyInstance) {
  // GET /api/accounts - List user's linked accounts
  fastify.get('/', { preHandler: [requireAuth] }, async (req) => {
    const accounts = await db.linkedAccount.findMany({
      where: { userId: req.user!.id },
    });

    const dtos: LinkedAccountDTO[] = accounts.map((acc: any) => {
      const limit = acc.quotaLimit ? BigInt(acc.quotaLimit) : BigInt(15 * 1024 * 1024 * 1024);
      const usage = acc.quotaUsage ? BigInt(acc.quotaUsage) : BigInt(0);
      const free = limit > usage ? limit - usage : BigInt(0);
      const percent = limit > BigInt(0) ? Math.min(100, Math.round((Number(usage) / Number(limit)) * 100)) : 0;

      return {
        id: acc.id,
        userId: acc.userId,
        googleId: acc.googleId,
        email: acc.email,
        displayName: acc.displayName,
        avatarUrl: acc.avatarUrl,
        label: acc.label,
        scopes: acc.scopes,
        status: acc.status,
        lastSyncAt: acc.lastSyncAt ? acc.lastSyncAt.toISOString() : null,
        quotaLimit: acc.quotaLimit ? acc.quotaLimit.toString() : null,
        quotaUsage: acc.quotaUsage ? acc.quotaUsage.toString() : null,
        quotaUsageInDrive: acc.quotaUsageInDrive ? acc.quotaUsageInDrive.toString() : null,
        quotaUsageInTrash: acc.quotaUsageInTrash ? acc.quotaUsageInTrash.toString() : null,
        freeBytes: free.toString(),
        percentUsed: percent,
      };
    });

    return { accounts: dtos };
  });

  // GET /api/accounts/connect - Generate Google OAuth consent URL
  fastify.get('/connect', { preHandler: [requireAuth] }, async (req) => {
    if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
      return {
        url: null,
        isConfigured: false,
        message: 'Google OAuth credentials are not configured in .env. You can add simulated Demo accounts instead.',
      };
    }

    const oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      config.GOOGLE_REDIRECT_URI
    );

    const state = crypto.randomBytes(24).toString('hex');
    oauthStates.set(state, { userId: req.user!.id, timestamp: Date.now() });

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

  // GET /api/accounts/callback - OAuth redirect handler
  fastify.get('/callback', async (req, reply) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

    if (error) {
      return reply.redirect(`${config.APP_URL}/accounts?error=${encodeURIComponent(error)}`);
    }

    if (!state || !oauthStates.has(state)) {
      return reply.redirect(`${config.APP_URL}/accounts?error=Invalid+or+expired+OAuth+state`);
    }

    const { userId } = oauthStates.get(state)!;
    oauthStates.delete(state);

    try {
      const oauth2Client = new google.auth.OAuth2(
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        config.GOOGLE_REDIRECT_URI
      );

      const { tokens } = await oauth2Client.getToken(code!);
      oauth2Client.setCredentials(tokens);

      if (!tokens.refresh_token) {
        return reply.redirect(`${config.APP_URL}/accounts?error=No+refresh+token+returned.+Please+revoke+app+access+and+try+again.`);
      }

      // Fetch user profile info from Google
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const googleId = userInfo.data.id!;
      const email = userInfo.data.email!;
      const displayName = userInfo.data.name || null;
      const avatarUrl = userInfo.data.picture || null;

      // Encrypt refresh token
      const enc = encryptToken(tokens.refresh_token);

      // Check if account already linked
      const existing = await db.linkedAccount.findFirst({
        where: { userId, googleId },
      });

      let accountId: string;
      if (existing) {
        const updated = await db.linkedAccount.update({
          where: { id: existing.id },
          data: {
            email,
            displayName,
            avatarUrl,
            refreshTokenEnc: enc.ciphertext,
            refreshTokenIv: enc.iv,
            refreshTokenTag: enc.tag,
            scopes: config.GOOGLE_SCOPES,
            status: 'active',
          },
        });
        accountId = updated.id;
      } else {
        const created = await db.linkedAccount.create({
          data: {
            userId,
            googleId,
            email,
            displayName,
            avatarUrl,
            refreshTokenEnc: enc.ciphertext,
            refreshTokenIv: enc.iv,
            refreshTokenTag: enc.tag,
            scopes: config.GOOGLE_SCOPES,
            status: 'active',
          },
        });
        accountId = created.id;
      }

      // Invalidate any cached client and trigger sync in background
      invalidateDriveClient(accountId);
      syncService.syncAccount(accountId).catch(console.warn);

      return reply.redirect(`${config.APP_URL}/accounts?success=Account+linked+successfully`);
    } catch (err: any) {
      return reply.redirect(`${config.APP_URL}/accounts?error=${encodeURIComponent(err.message || 'OAuth linking failed')}`);
    }
  });

  // POST /api/accounts/demo - Add a simulated demo account
  fastify.post('/demo', { preHandler: [requireAuth] }, async (req, reply) => {
    const { email, label } = req.body as { email?: string; label?: string };
    const randId = Math.floor(Math.random() * 900) + 100;
    const accountEmail = email || `demo.drive.${randId}@omnidrive.io`;
    const accountLabel = label || `Demo Drive ${randId}`;

    const enc = encryptToken(`demo_token_${randId}`);

    const acc = await db.linkedAccount.create({
      data: {
        userId: req.user!.id,
        googleId: `demo_google_${randId}_${Date.now()}`,
        email: accountEmail,
        displayName: accountLabel,
        label: accountLabel,
        refreshTokenEnc: enc.ciphertext,
        refreshTokenIv: enc.iv,
        refreshTokenTag: enc.tag,
        scopes: config.GOOGLE_SCOPES,
        status: 'active',
        quotaLimit: BigInt(15) * BigInt(1024 * 1024 * 1024),
        quotaUsage: BigInt(2) * BigInt(1024 * 1024 * 1024),
        quotaUsageInDrive: BigInt(1800) * BigInt(1024 * 1024),
        quotaUsageInTrash: BigInt(200) * BigInt(1024 * 1024),
      },
    });

    await syncService.syncAccount(acc.id).catch(console.warn);

    return { account: acc };
  });

  // PATCH /api/accounts/:id - Update label or status
  fastify.patch('/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parseResult = updateAccountSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
        },
      });
    }

    const account = await db.linkedAccount.findUnique({ where: { id } });
    if (!account || account.userId !== req.user!.id) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Account not found' },
      });
    }

    const updated = await db.linkedAccount.update({
      where: { id },
      data: parseResult.data,
    });

    return { account: updated };
  });

  // DELETE /api/accounts/:id - Unlink account
  fastify.delete('/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const account = await db.linkedAccount.findUnique({ where: { id } });

    if (!account || account.userId !== req.user!.id) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Account not found' },
      });
    }

    // Try revoking Google token if real OAuth
    if (!account.googleId.startsWith('demo_')) {
      try {
        const { decryptToken } = await import('../services/crypto.service');
        const token = decryptToken(
          Buffer.from(account.refreshTokenEnc),
          Buffer.from(account.refreshTokenIv),
          Buffer.from(account.refreshTokenTag)
        );
        const oauth2Client = new google.auth.OAuth2(
          config.GOOGLE_CLIENT_ID,
          config.GOOGLE_CLIENT_SECRET
        );
        await oauth2Client.revokeToken(token);
      } catch (err) {
        // Continue unlinking even if revocation fails
      }
    }

    invalidateDriveClient(id);
    await db.linkedAccount.delete({ where: { id } });

    return { success: true };
  });

  // POST /api/accounts/:id/sync - Trigger on-demand full sync
  fastify.post('/:id/sync', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const account = await db.linkedAccount.findUnique({ where: { id } });

    if (!account || account.userId !== req.user!.id) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Account not found' },
      });
    }

    const result = await syncService.syncAccount(id);
    return { success: true, result };
  });
}
