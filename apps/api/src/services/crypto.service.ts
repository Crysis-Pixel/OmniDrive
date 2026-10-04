import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 12 or 16 bytes for GCM

function getEncryptionKey(): Buffer {
  const rawKey = config.TOKEN_ENCRYPTION_KEY;
  let keyBuf: Buffer;
  
  try {
    keyBuf = Buffer.from(rawKey, 'base64');
    if (keyBuf.length !== 32) {
      keyBuf = Buffer.from(rawKey, 'utf-8');
    }
  } catch {
    keyBuf = Buffer.from(rawKey, 'utf-8');
  }

  if (keyBuf.length !== 32) {
    // Pad or hash to exactly 32 bytes if necessary
    return crypto.createHash('sha256').update(rawKey).digest();
  }
  return keyBuf;
}

export interface EncryptedData {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

/**
 * Encrypt token with AES-256-GCM using random IV
 */
export function encryptToken(plainText: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext,
    iv,
    tag,
  };
}

/**
 * Decrypt token with AES-256-GCM using stored IV and Auth Tag
 */
export function decryptToken(ciphertext: Buffer, iv: Buffer, tag: Buffer): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
