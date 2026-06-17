// Shared wrapper for the inventory module's Server Actions — folds api-rest
// errors into the platform `ActionResult` envelope (docs/06 §4) so REST and
// Server Actions report the same condition the same way. api-rest enforces the
// inventory module gate at the route level itself (requireInventoryModule).

import 'server-only';

import type { ApiRestError } from '@/lib/api-rest-client';

// Discriminated on `ok`; callers narrow without instanceof checks. `context`
// carries route-specific detail (e.g. variant id for an OUT_OF_STOCK adjust).
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: { field: string; message: string }[];
        module?: string;
        context?: Record<string, unknown>;
      };
    };

export async function restAction<T>(handler: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await handler();
    return { ok: true, data };
  } catch (err) {
    return mapRestError(err);
  }
}

export function mapRestError(err: unknown): ActionResult<never> {
  const restErr = err as ApiRestError;
  const code = restErr.code ?? 'INTERNAL_ERROR';
  const message = restErr.message ?? 'Unexpected error';
  const raw = restErr.details;

  if (Array.isArray(raw)) {
    return {
      ok: false,
      error: { code, message, details: raw as { field: string; message: string }[] },
    };
  }
  if (raw && typeof raw === 'object') {
    return {
      ok: false,
      error: { code, message, context: raw as Record<string, unknown> },
    };
  }
  return { ok: false, error: { code, message } };
}
