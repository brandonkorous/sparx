'use server';

import { revalidatePath } from 'next/cache';

import { api } from '@/lib/api-rest-client';

import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';

// ─── Rule CRUD ────────────────────────────────────────────────────────

export async function createMarkupRuleAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string }>('/v1/markup-rules', input);
    revalidatePath('/commerce/markup-rules');
    return result;
  });
}

export async function updateMarkupRuleAction(
  id: string,
  input: unknown
): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.patch<{ id: string }>(`/v1/markup-rules/${id}`, input);
    revalidatePath('/commerce/markup-rules');
    return { ok: true as const };
  });
}

export async function deleteMarkupRuleAction(id: string): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.delete(`/v1/markup-rules/${id}`);
    revalidatePath('/commerce/markup-rules');
    return { ok: true as const };
  });
}

// ─── Preview / apply over a scope ──────────────────────────────────────

export interface MarkupPreviewLine {
  variantId: string;
  productId: string;
  sku: string;
  title: string | null;
  costCents: number | null;
  currentPriceCents: number;
  newPriceCents: number | null;
  profitCents: number | null;
  marginPct: number | null;
  markupPct: number | null;
  method: string | null;
  unpriceable: boolean;
}

export interface MarkupPreviewResult {
  ruleId: string;
  scope: unknown;
  totalVariants: number;
  pricedVariants: number;
  unpriceableVariants: number;
  truncated: boolean;
  lines: MarkupPreviewLine[];
}

export async function previewMarkupRuleAction(
  id: string,
  scope?: unknown
): Promise<ActionResult<MarkupPreviewResult>> {
  return restAction(() =>
    api.post<MarkupPreviewResult>(`/v1/markup-rules/${id}/preview`, scope ? { scope } : {})
  );
}

export async function applyMarkupRuleAction(
  id: string,
  scope?: unknown
): Promise<ActionResult<{ ruleId: string; applied: number; skipped: number; capped: boolean }>> {
  return restAction(async () => {
    const result = await api.post<{
      ruleId: string;
      applied: number;
      skipped: number;
      capped: boolean;
    }>(`/v1/markup-rules/${id}/apply`, scope ? { scope } : {});
    revalidatePath('/commerce/markup-rules');
    return result;
  });
}

// ─── Variant binding (the product editor "Price by rule" toggle) ────────

export async function bindVariantMarkupAction(
  variantId: string,
  productId: string,
  ruleId: string
): Promise<ActionResult<{ variantId: string; priceCents: number }>> {
  return restAction(async () => {
    const result = await api.put<{ variantId: string; priceCents: number }>(
      `/v1/commerce/variants/${variantId}/markup`,
      { ruleId }
    );
    revalidatePath(`/commerce/products/${productId}`);
    return result;
  });
}

export async function unbindVariantMarkupAction(
  variantId: string,
  productId: string
): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.delete(`/v1/commerce/variants/${variantId}/markup`);
    revalidatePath(`/commerce/products/${productId}`);
    return { ok: true as const };
  });
}
