// Shared wrapper for Automations Server Actions — mirrors the CRM/Email
// `restAction` pattern but kept surface-local so /automations never imports from
// another module's folder. Folds any api-rest error into the platform
// ActionResult shape the form/list components read.
//
// The api-rest `automationErrorMapper` maps the service's tier guard to a
// distinct code: AUTOMATION_LOCKED (409) for an edit/status/delete on a
// platform-managed rule, so the UI can offer "Duplicate to edit" instead of a
// generic failure.

import 'server-only';

import type { ApiRestError } from '@/lib/api-rest-client';

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: string; message: string; details?: { field: string; message: string }[] };
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
  const details = Array.isArray(restErr.details)
    ? (restErr.details as { field: string; message: string }[])
    : undefined;
  return {
    ok: false,
    error: {
      code: restErr.code ?? 'INTERNAL_ERROR',
      message: restErr.message ?? 'Unexpected error',
      ...(details ? { details } : {}),
    },
  };
}
