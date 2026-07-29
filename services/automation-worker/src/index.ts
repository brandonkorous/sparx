// automation-worker entrypoint. Constructs the HTTP server (see server.ts for
// the route contract) and listens; the server logic itself is side-effect-free
// so the integration suite can drive it on an ephemeral port.

// MUST be first: raises DATABASE_URL's connection_limit before `@sparx/db`'s client
// is constructed (it reads the pool size at import). The tick pattern needs >= 2
// connections or every tick deadlocks with P2024 — see boot-db-pool.ts. Imported
// only here (the entrypoint), so the integration suite driving server.ts is unaffected.
import './boot-db-pool.js';

import { env } from './env.js';
import { createWorkerServer, logger } from './server.js';

const server = createWorkerServer();

server.listen(env.PORT, '0.0.0.0', () => {
  logger.info({ port: env.PORT }, 'automation-worker listening');
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'shutdown received; draining');
  server.close(() => {
    logger.info('server closed; exiting');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 9_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
