'use server';

// Fleet / work-order hold actions for the B2B account detail (docs/100 P6d).
// A hold reserves stock against the master for the account's work order; the
// create flow resolves a SKU to a variant first, then places the hold. Release
// frees it; consume commits it (the job shipped). Server-only — the api token
// never reaches the browser.

import { api, type ApiRestError } from '@/lib/api-rest-client';

interface VariantLookup {
  variantId: string;
  sku: string;
  productTitle: string | null;
}

export interface AvailabilityRow {
  variantId: string;
  sku: string | null;
  title: string | null;
  available: number;
  heldForAccount: number;
  minOrderQty: number | null;
  maxOrderQty: number | null;
}

function message(err: unknown): string {
  return (err as ApiRestError).message ?? 'Request failed.';
}

/** Resolve a SKU and return the account's availability for it. */
export async function checkAvailabilityAction(
  accountId: string,
  sku: string
): Promise<{ variantId: string; row: AvailabilityRow } | { error: string }> {
  try {
    const variant = await api.get<VariantLookup>(
      `/v1/inventory/suppliers/variant-lookup?sku=${encodeURIComponent(sku)}`
    );
    const rows = await api.post<AvailabilityRow[]>(`/v1/b2b/accounts/${accountId}/availability`, {
      variantIds: [variant.variantId],
    });
    const row = rows[0];
    if (!row) return { error: 'No availability for that SKU.' };
    return { variantId: variant.variantId, row };
  } catch (err) {
    return { error: message(err) };
  }
}

export async function createFleetHoldAction(
  accountId: string,
  input: { variantId: string; quantity: number; workOrderRef: string; note?: string }
): Promise<{ ok: true } | { error: string }> {
  try {
    await api.post(`/v1/b2b/accounts/${accountId}/holds`, {
      variantId: input.variantId,
      quantity: input.quantity,
      workOrderRef: input.workOrderRef,
      ...(input.note ? { note: input.note } : {}),
    });
    return { ok: true };
  } catch (err) {
    return { error: message(err) };
  }
}

export async function releaseFleetHoldAction(
  holdId: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await api.post(`/v1/b2b/holds/${holdId}/release`);
    return { ok: true };
  } catch (err) {
    return { error: message(err) };
  }
}

export async function consumeFleetHoldAction(
  holdId: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await api.post(`/v1/b2b/holds/${holdId}/consume`);
    return { ok: true };
  } catch (err) {
    return { error: message(err) };
  }
}
