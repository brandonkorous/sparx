// sparx Inventory Bridge — Tier A on-prem agent entrypoint (docs/100 P5d, docs/28).
//
// Reads on-hand stock from a local ERP export and pushes it to sparx over outbound
// HTTPS. Install on a machine on the tenant's network, configure via env (or a .env
// file beside the binary), and run as a service. See README.md.

import { loadConfig } from './config.js';
import { log } from './logger.js';
import { createReader } from './readers/index.js';
import { SparxBridgeClient } from './push-client.js';
import { startRunner } from './runner.js';
import { BRIDGE_VERSION } from './version.js';

function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(78); // EX_CONFIG
  }

  const reader = createReader(config);
  const client = new SparxBridgeClient(config);

  log.info('inventory-bridge starting', {
    version: BRIDGE_VERSION,
    sourceId: config.SPARX_SOURCE_ID,
    reader: config.BRIDGE_READER,
    syncIntervalSec: config.SYNC_INTERVAL_SEC,
    heartbeatIntervalSec: config.HEARTBEAT_INTERVAL_SEC,
  });

  const runner = startRunner(config, reader, client);

  const shutdown = (signal: string): void => {
    log.info('inventory-bridge stopping', { signal });
    runner.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
