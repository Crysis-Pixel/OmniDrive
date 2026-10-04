import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { config } from '../config';
import { RegisterInput, LoginInput, UserDTO } from '@omnidrive/shared';
import { encryptToken } from './crypto.service';

export class AuthService {
  /**
   * Register new user
   */
  async register(input: RegisterInput): Promise<UserDTO> {
    const existing = await db.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new Error('A user with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    const user = await db.user.create({
      data: {
        email: input.email,
        passwordHash,
        settings: {
          create: {
            uploadStrategy: 'most_free',
            accountPriority: [],
          },
        },
      },
    });

    const settings = await db.userSettings.findUnique({
      where: { userId: user.id },
    });

    // If demo mode is active, automatically link sample accounts for immediate exploration
    if (config.ENABLE_DEMO_ACCOUNTS) {
      await this.seedDemoAccounts(user.id);
    }

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      settings: settings
        ? {
            userId: settings.userId,
            uploadStrategy: settings.uploadStrategy as any,
            accountPriority: settings.accountPriority,
          }
        : null,
    };
  }

  /**
   * Login user with email & password
   */
  async login(input: LoginInput): Promise<{ user: UserDTO; token: string }> {
    const user = await db.user.findUnique({
      where: { email: input.email },
    });

    if (!user || !user.passwordHash) {
      throw new Error('Invalid email or password');
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    const token = this.generateSessionToken(user.id, user.email);
    const settings = await db.userSettings.findUnique({
      where: { userId: user.id },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        settings: settings
          ? {
              userId: settings.userId,
              uploadStrategy: settings.uploadStrategy as any,
              accountPriority: settings.accountPriority,
            }
          : null,
      },
      token,
    };
  }

  /**
   * Verify session token and return user
   */
  async verifySession(token: string): Promise<UserDTO | null> {
    try {
      const decoded: any = jwt.verify(token, config.SESSION_SECRET);
      if (!decoded || !decoded.userId) return null;

      const user = await db.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) return null;

      const settings = await db.userSettings.findUnique({
        where: { userId: user.id },
      });

      return {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        settings: settings
          ? {
              userId: settings.userId,
              uploadStrategy: settings.uploadStrategy as any,
              accountPriority: settings.accountPriority,
            }
          : null,
      };
    } catch {
      return null;
    }
  }

  generateSessionToken(userId: string, email: string): string {
    return jwt.sign({ userId, email }, config.SESSION_SECRET, { expiresIn: '7d' });
  }

  /**
   * Seed demo Google accounts for the user if enabled
   */
  async seedDemoAccounts(userId: string) {
    const existing = await db.linkedAccount.findMany({ where: { userId } });
    if (existing.length > 0) return;

    const enc1 = encryptToken('demo_refresh_token_work');
    const enc2 = encryptToken('demo_refresh_token_personal');

    const acc1 = await db.linkedAccount.create({
      data: {
        userId,
        googleId: 'demo_google_work_1',
        email: 'alex.work@company.io',
        displayName: 'Alex (Work Drive)',
        label: 'Work Account',
        refreshTokenEnc: enc1.ciphertext,
        refreshTokenIv: enc1.iv,
        refreshTokenTag: enc1.tag,
        scopes: config.GOOGLE_SCOPES,
        status: 'active',
        quotaLimit: BigInt(30) * BigInt(1024 * 1024 * 1024), // 30 GB
        quotaUsage: BigInt(8) * BigInt(1024 * 1024 * 1024),
        quotaUsageInDrive: BigInt(7) * BigInt(1024 * 1024 * 1024),
        quotaUsageInTrash: BigInt(1) * BigInt(1024 * 1024 * 1024),
      },
    });

    const acc2 = await db.linkedAccount.create({
      data: {
        userId,
        googleId: 'demo_google_personal_2',
        email: 'alex.personal@gmail.com',
        displayName: 'Alex Personal',
        label: 'Personal Drive',
        refreshTokenEnc: enc2.ciphertext,
        refreshTokenIv: enc2.iv,
        refreshTokenTag: enc2.tag,
        scopes: config.GOOGLE_SCOPES,
        status: 'active',
        quotaLimit: BigInt(15) * BigInt(1024 * 1024 * 1024), // 15 GB
        quotaUsage: BigInt(3) * BigInt(1024 * 1024 * 1024),
        quotaUsageInDrive: BigInt(2800) * BigInt(1024 * 1024),
        quotaUsageInTrash: BigInt(200) * BigInt(1024 * 1024),
      },
    });

    // Initial sync of demo files into local cache
    const { syncService } = await import('./sync.service');
    await syncService.syncAccount(acc1.id).catch(console.warn);
    await syncService.syncAccount(acc2.id).catch(console.warn);
  }
}

export const authService = new AuthService();
