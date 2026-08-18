// Entrypoint for the site MCP server (docs/113).

import { createApp } from './app.js';
import { env } from './env.js';

async function main(): Promise<void> {
  const app = await createApp();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((err) => {
  console.error('[mcp-site] failed to start', err);
  process.exit(1);
});
