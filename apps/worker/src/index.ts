import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

console.log('⚡ Starting OmniDrive BullMQ Background Worker...');

let connection: IORedis | null = null;
try {
  connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });
} catch (err) {
  console.warn('Could not initialize Redis connection for worker:', err);
}

async function startWorker() {
  if (!connection) {
    console.log('ℹ️ Redis not configured. In-process job runner is active in the API server.');
    return;
  }

  try {
    await connection.connect();
    console.log('Connected to Redis for background workers.');

    const transferWorker = new Worker(
      'omnidrive-transfers',
      async (job: Job) => {
        console.log(`Processing transfer job: ${job.id}`);
        // Worker processes transfer
        return { success: true };
      },
      { connection }
    );

    transferWorker.on('completed', (job) => {
      console.log(`Transfer job ${job.id} completed!`);
    });

    transferWorker.on('failed', (job, err) => {
      console.error(`Transfer job ${job?.id} failed:`, err);
    });
  } catch (err) {
    console.warn('Redis worker could not connect to Redis server. In-process workers active.', err);
  }
}

startWorker();
