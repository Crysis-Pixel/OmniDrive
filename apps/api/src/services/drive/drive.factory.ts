import { db } from '../../db';
import { decryptToken } from '../crypto.service';
import { IDriveClient } from './drive.interface';
import { GoogleDriveClient } from './google-drive.client';
import { FakeDriveClient } from './fake-drive.client';

// Client cache per account ID
const clientCache = new Map<string, IDriveClient>();
const fakeDrives = new Map<string, FakeDriveClient>();

export function getFakeDriveInstance(accountId: string, email: string, displayName: string): FakeDriveClient {
  let fake = fakeDrives.get(accountId);
  if (!fake) {
    fake = new FakeDriveClient(email, displayName, true);
    fakeDrives.set(accountId, fake);
  }
  return fake;
}

export async function getDriveClient(accountId: string): Promise<IDriveClient> {
  const cached = clientCache.get(accountId);
  if (cached) return cached;

  const account = await db.linkedAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error(`Linked account ${accountId} not found`);
  }

  if (account.status === 'disabled') {
    throw new Error(`Account ${account.email} is currently disabled`);
  }

  // Check if demo/fake account
  if (account.googleId.startsWith('demo_') || !account.refreshTokenEnc) {
    const fake = getFakeDriveInstance(account.id, account.email, account.displayName || account.email);
    clientCache.set(accountId, fake);
    return fake;
  }

  try {
    const refreshToken = decryptToken(
      Buffer.from(account.refreshTokenEnc),
      Buffer.from(account.refreshTokenIv),
      Buffer.from(account.refreshTokenTag)
    );

    const client = new GoogleDriveClient(refreshToken);
    clientCache.set(accountId, client);
    return client;
  } catch (err: any) {
    // If decryption or auth fails, mark account as needs_reauth
    await db.linkedAccount.update({
      where: { id: accountId },
      data: { status: 'needs_reauth' },
    });
    throw new Error(`Failed to initialize Drive client for ${account.email}: ${err.message}`);
  }
}

export function invalidateDriveClient(accountId: string): void {
  clientCache.delete(accountId);
}
