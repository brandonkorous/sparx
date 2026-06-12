// Shared types for every Invoicing Server Action file. Mirrors the CRM/commerce
// _action-helpers — the actions go through api-rest, so this only owns the
// ActionResult envelope shape (api-rest enforces the invoicing module gate).

import 'server-only';

// Mirrors the platform error envelope (docs/06 §4) so REST and Server Actions
// report the same condition the same way. The discriminated union on `ok` lets
// callers narrow without instanceof checks.
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: { field: string; message: string }[];
        module?: string;
      };
    };
