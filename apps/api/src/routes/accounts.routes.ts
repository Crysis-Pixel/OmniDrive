import { FastifyInstance } from 'fastify';
import { google } from 'googleapis';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.middleware';
import { db } from '../db';
import { config } from '../config';
import { encryptToken } from '../services/crypto.service';
import { syncService } from '../services/sync.service';
import { authService } from '../services/auth.service';
import { updateAccountSchema, LinkedAccountDTO } from '@omnidrive/shared';
import { invalidateDriveClient } from '../services/drive/drive.factory';

export interface OAuthStateData {
  userId?: string;
  isLogin?: boolean;
  timestamp: number;
}

// In-memory OAuth state cache (maps state -> stateData)
export const oauthStates = new Map<string, OAuthStateData>();

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

    const getAppRedirect = (pathWithQuery: string) => {
      if (config.SERVE_STATIC) {
        return pathWithQuery;
      }
      return `${config.APP_URL}${pathWithQuery}`;
    };

    if (error) {
      return reply.redirect(getAppRedirect(`/login?error=${encodeURIComponent(error)}`));
    }

    if (!state || !oauthStates.has(state)) {
      return reply.redirect(getAppRedirect('/login?error=Invalid+or+expired+OAuth+state'));
    }

    const stateData = oauthStates.get(state)!;
    oauthStates.delete(state);

    try {
      const oauth2Client = new google.auth.OAuth2(
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        config.GOOGLE_REDIRECT_URI
      );

      const { tokens } = await oauth2Client.getToken(code!);
      oauth2Client.setCredentials(tokens);

      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      let googleId = '';
      let email = '';
      let displayName: string | null = null;
      let avatarUrl: string | null = null;
      let quotaLimit: string | null = null;
      let quotaUsage: string | null = null;
      let quotaUsageInDrive: string | null = null;
      let quotaUsageInTrash: string | null = null;

      // Extract user info from Drive About API
      try {
        const about = await drive.about.get({ fields: 'user, storageQuota' });
        if (about.data.user) {
          googleId = about.data.user.permissionId || '';
          email = about.data.user.emailAddress || '';
          displayName = about.data.user.displayName || null;
          avatarUrl = about.data.user.photoLink || null;
        }
        if (about.data.storageQuota) {
          quotaLimit = about.data.storageQuota.limit || null;
          quotaUsage = about.data.storageQuota.usage || null;
          quotaUsageInDrive = about.data.storageQuota.usageInDrive || null;
          quotaUsageInTrash = about.data.storageQuota.usageInDriveTrash || null;
        }
      } catch (aboutErr) {
        console.warn('Failed to fetch drive.about:', aboutErr);
      }

      // If ID token is present, fallback / supplement with JWT payload
      if (tokens.id_token) {
        try {
          const parts = tokens.id_token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            if (!googleId) googleId = payload.sub || '';
            if (!email) email = payload.email || '';
            if (!displayName) displayName = payload.name || null;
            if (!avatarUrl) avatarUrl = payload.picture || null;
          }
        } catch (e) {
          // ignore
        }
      }

      // Final fallback: try oauth2 userinfo if still missing
      if (!email) {
        try {
          const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
          const userInfo = await oauth2.userinfo.get();
          if (userInfo.data.id && !googleId) googleId = userInfo.data.id;
          if (userInfo.data.email && !email) email = userInfo.data.email;
          if (userInfo.data.name && !displayName) displayName = userInfo.data.name;
          if (userInfo.data.picture && !avatarUrl) avatarUrl = userInfo.data.picture;
        } catch (uiErr) {
          console.warn('Userinfo fallback failed:', uiErr);
        }
      }

      if (!email) {
        return reply.redirect(getAppRedirect('/accounts?error=Unable+to+retrieve+Google+account+email.+Please+ensure+the+Google+Drive+API+is+enabled+in+Google+Cloud+Console.'));
      }
      if (!googleId) {
        googleId = `g_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }

      // If user came from Login / Register screen, auto-create or find their user record
      let userId = stateData.userId;
      if (stateData.isLogin) {
        let user = await db.user.findUnique({ where: { email } });
        if (!user) {
          user = await db.user.create({
            data: {
              email,
              passwordHash: null,
              settings: {
                create: {
                  uploadStrategy: 'most_free',
                  accountPriority: [],
                },
              },
            },
          });
        }
        userId = user.id;
      }

      if (!userId) {
        return reply.redirect(getAppRedirect('/login?error=User+session+not+found'));
      }

      // Check if account already linked
      const existing = await db.linkedAccount.findFirst({
        where: { userId, googleId },
      });

      let enc = null;
      if (tokens.refresh_token) {
        enc = encryptToken(tokens.refresh_token);
      } else if (existing?.refreshTokenEnc) {
        // Reuse existing refresh token if re-authorizing
        enc = {
          ciphertext: existing.refreshTokenEnc,
          iv: existing.refreshTokenIv,
          tag: existing.refreshTokenTag,
        };
      } else {
        return reply.redirect(getAppRedirect('/accounts?error=Google+did+not+return+a+refresh+token.+Please+visit+https://myaccount.google.com/connections,+remove+OmniDrive,+and+link+again.'));
      }

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
            quotaLimit,
            quotaUsage,
            quotaUsageInDrive,
            quotaUsageInTrash,
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
            quotaLimit,
            quotaUsage,
            quotaUsageInDrive,
            quotaUsageInTrash,
          },
        });
        accountId = created.id;
      }

      // Invalidate any cached client and trigger sync in background
      invalidateDriveClient(accountId);
      syncService.syncAccount(accountId).catch(console.warn);

      if (stateData.isLogin) {
        const sessionToken = authService.generateSessionToken(userId, email);
        reply.setCookie('session_token', sessionToken, {
          httpOnly: true,
          secure: config.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        });

        return reply.redirect(getAppRedirect(`/?token=${sessionToken}&success=Signed+in+with+Google`));
      }

      return reply.redirect(getAppRedirect('/accounts?success=Account+linked+successfully'));
    } catch (err: any) {
      const errRedirect = stateData?.isLogin ? '/login' : '/accounts';
      return reply.redirect(getAppRedirect(`${errRedirect}?error=${encodeURIComponent(err.message || 'OAuth linking failed')}`));
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
