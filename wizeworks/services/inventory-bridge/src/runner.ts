// The agent loop. Two independent cadences:
//   • snapshot  — read the local export + push it (the reconcile), every SYNC_INTERVAL.
//   • heartbeat — a lightweight liveness ping, every HEARTBEAT_INTERVAL, so the
//     dashboard's online/offline indicator stays fresh between snapshots.
// One snapshot + one heartbeat fire immediately on boot, then on their timers. A
// read/push error is logged and the loop continues — a transient ERP-export glitch
// must not take the agent down.

import type { BridgeConfig } from './config.js';
import { log } from './logger.js';
import type { InventoryReader } from './readers/types.js';
import type { SparxBridgeClient } from './push-client.js';

export interface Runner {
  stop(): void;
}

export function startRunner(
  config: BridgeConfig,
  reader: InventoryReader,
  client: SparxBridgeClient
): Runner {
  let stopped = false;

  const runSnapshot = async (): Promise<void> => {
    if (stopped) return;
    try {
      const snapshot = await reader.readSnapshot();
      const result = await client.pushSnapshot(snapshot.rows, snapshot.observedAt);
      log.info('snapshot pushed', {
        rows: snapshot.rows.length,
        observedAt: snapshot.observedAt,
        processed: result.processed,
        unmatched: result.unmatched,
        skipped: result.skipped,
      });
    } catch (err) {
      log.error('snapshot failed', { err: err instanceof Error ? err.message : String(err) });
    }
  };

  const runHeartbeat = async (): Promise<void> => {
    if (stopped) return;
    try {
      await client.heartbeat();
    } catch (err) {
      log.warn('heartbeat failed', { err: err instanceof Error ? err.message : String(err) });
    }
  };

  // Fire both immediately, then on their intervals.
  void runSnapshot();
  void runHeartbeat();
  const snapshotTimer = setInterval(() => void runSnapshot(), config.SYNC_INTERVAL_SEC * 1_000);
  const heartbeatTimer = setInterval(
    () => void runHeartbeat(),
    config.HEARTBEAT_INTERVAL_SEC * 1_000
  );

  return {
    stop() {
      stopped = true;
      clearInterval(snapshotTimer);
      clearInterval(heartbeatTimer);
    },
  };
}
