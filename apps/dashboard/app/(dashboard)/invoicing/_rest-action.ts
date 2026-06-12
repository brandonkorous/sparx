// Shared wrapper for the Invoicing Server Actions — folds api-rest errors into
// the platform ActionResult shape (mirrors the CRM/commerce wrapper).

import 'server-only';

import type { ApiRestError } from '@/lib/api-rest-client';

import type { ActionResult } from './_action-helpers';

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
