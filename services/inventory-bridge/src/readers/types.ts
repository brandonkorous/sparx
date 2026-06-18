// The reader abstraction — the only system-specific part of the bridge. A reader
// produces a normalized snapshot of on-hand stock; everything downstream (push,
// retry, heartbeat) is system-agnostic. Adding a new ERP = writing one reader.

export interface BridgeRow {
  sku: string;
  location: string | null;
  quantity: number;
}

export interface InventorySnapshot {
  rows: BridgeRow[];
  /**
   * When the source observed these quantities (ISO 8601). Stamped on every pushed
   * row as `synced_at` so sparx's last-writer ordering drops an out-of-order
   * snapshot rather than clobbering a fresher one. For a file reader this is the
   * export file's modification time.
   */
  observedAt: string;
}

export interface InventoryReader {
  /** Read the current full on-hand snapshot from the local system. */
  readSnapshot(): Promise<InventorySnapshot>;
}
