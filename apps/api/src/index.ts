import { createServer } from './server';
import { config } from './config';

async function main() {
  try {
    const server = await createServer();
    const address = await server.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });
    console.log(`🚀 OmniDrive API server listening at ${address}`);
    console.log(`🌐 Environment: ${config.NODE_ENV}, Port: ${config.PORT}`);
  } catch (err) {
    console.error('Failed to start OmniDrive API server:', err);
    process.exit(1);
  }
}

main();
