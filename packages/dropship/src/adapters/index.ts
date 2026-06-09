// Adapter registry — maps supplier type strings to their adapter classes.
// Import this module instead of individual adapter files to get all adapters.

import type { Credentials, SupplierAdapter } from '../types.js';
import { CsvAdapter } from './csv.js';
import { DsersAdapter } from './dsers.js';
import { SpocketAdapter } from './spocket.js';

export { CsvAdapter } from './csv.js';
export type { CsvCredentials, CsvColumnMapping } from './csv.js';

export { DsersAdapter } from './dsers.js';
export type { DsersCredentials } from './dsers.js';

export { SpocketAdapter } from './spocket.js';
export type { SpocketCredentials } from './spocket.js';

/** Construct the right adapter for a given supplier type.
 *  Throws if the type has no registered adapter. */
export function createAdapter(type: string, credentials: Credentials): SupplierAdapter {
  switch (type) {
    case 'csv':
      return new CsvAdapter(credentials);
    case 'dsers':
      return new DsersAdapter(credentials);
    case 'spocket':
      return new SpocketAdapter(credentials);
    default:
      throw new Error(`No adapter registered for supplier type: ${type}`);
  }
}
