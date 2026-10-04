import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from '../src/services/crypto.service';

describe('CryptoService AES-256-GCM', () => {
  it('should encrypt and decrypt a token correctly', () => {
    const originalToken = 'google_refresh_token_1234567890_abcdef';
    const encrypted = encryptToken(originalToken);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();

    const decrypted = decryptToken(encrypted.ciphertext, encrypted.iv, encrypted.tag);
    expect(decrypted).toBe(originalToken);
  });

  it('should generate different IVs for subsequent encryptions of the same token', () => {
    const token = 'same_token';
    const enc1 = encryptToken(token);
    const enc2 = encryptToken(token);

    expect(enc1.iv.toString('hex')).not.toBe(enc2.iv.toString('hex'));
    expect(decryptToken(enc1.ciphertext, enc1.iv, enc1.tag)).toBe(token);
    expect(decryptToken(enc2.ciphertext, enc2.iv, enc2.tag)).toBe(token);
  });
});
