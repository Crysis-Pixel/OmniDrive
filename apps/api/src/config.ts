import dotenv from 'dotenv';
import path from 'path';

// Load .env from root or current dir
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  APP_URL: process.env.APP_URL || 'http://localhost:5173',
  
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/omnidrive',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  SESSION_SECRET: process.env.SESSION_SECRET || 'omnidrive_super_secure_session_secret_key_minimum_32_chars',
  TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY || 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=',
  
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/accounts/callback',
  GOOGLE_SCOPES: (process.env.GOOGLE_SCOPES || 'https://www.googleapis.com/auth/drive').split(' '),
  
  UPLOAD_CHUNK_BYTES: parseInt(process.env.UPLOAD_CHUNK_BYTES || '8388608', 10), // 8MB default
  SYNC_INTERVAL_SECONDS: parseInt(process.env.SYNC_INTERVAL_SECONDS || '120', 10),
  
  SERVE_STATIC: process.env.SERVE_STATIC === 'true' || process.env.NODE_ENV === 'production',
  ENABLE_DEMO_ACCOUNTS: process.env.ENABLE_DEMO_ACCOUNTS !== 'false',
  IN_PROCESS_WORKER: process.env.IN_PROCESS_WORKER === 'true' || !process.env.REDIS_URL,
};
