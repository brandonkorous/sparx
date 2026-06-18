// Reader factory — picks the system-specific reader from config.

import type { BridgeConfig } from '../config.js';
import { FileReader } from './file-reader.js';
import type { InventoryReader } from './types.js';

export function createReader(config: BridgeConfig): InventoryReader {
  switch (config.BRIDGE_READER) {
    case 'file':
      // BRIDGE_FILE_PATH presence is guaranteed by the config refine.
      return new FileReader(config.BRIDGE_FILE_PATH!, config.BRIDGE_FILE_FORMAT);
    case 'fishbowl':
      // A Fishbowl-native reader (its LAN JSON API on :28192, or a query against its
      // MySQL-compatible DB) must be finalized against a REAL instance — exact
      // edition, API surface, and query differ per install (docs/28 §8). Until that
      // validation, configure the ERP to drop a scheduled CSV/JSON export and run
      // BRIDGE_READER=file (the universal path that works for every on-prem system).
      throw new Error(
        'The Fishbowl-native reader requires per-instance validation (docs/28 §8). ' +
          'Use BRIDGE_READER=file with a scheduled Fishbowl CSV/JSON export for now.'
      );
  }
}
