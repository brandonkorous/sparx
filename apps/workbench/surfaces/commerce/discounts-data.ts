'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE DISCOUNT DATA LAYER
//
// A discount reduces what a shopper pays at checkout. It is either a CODE they
// type ("SAVE10") or an AUTOMATIC one that applies on its own to any order that
// qualifies. Everything this layer sends satisfies `CreateDiscountInput` /
// `UpdateDiscountInput` from `@sparx/commerce-schemas` exactly — the same Zod the
// server validates on write, imported here so the editor cannot drift from it.
//
// ── The key contract ──────────────────────────────────────────────────────
//
//   ['commerce','discounts']              the root every read nests under
//   ['commerce','discounts','list',{q}]   the list surface's window
//   ['commerce','discounts', id]          one discount, in full
//
// Every write invalidates the ROOT prefix, so a new, edited, activated or
// retired discount shows correctly in both the list and the detail at once.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import {
  CreateDiscountInput as CreateDiscountInputSchema,
  type DiscountCondition,
  type DiscountScope,
  type DiscountStacking,
  type DiscountType,
} from '@sparx/commerce-schemas';
import { api } from '../../lib/api/client';
import type { Tone } from './products-data';

export type { DiscountCondition, DiscountScope, DiscountStacking, DiscountType };

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** One discount in full, as the detail pane edits it. Mirrors the api-rest
 *  `DiscountRow` (discount-service `serializeDiscount`). */
export interface Discount {
  id: string;
  /** null = an automatic discount (no code to type). */
  code: string | null;
  name: string;
  description: string | null;
  type: DiscountType;
  scope: DiscountScope;
  valueCents: number | null;
  valuePercent: number | null;
  currency: string | null;
  conditions: DiscountCondition[];
  startAt: string | null;
  endAt: string | null;
  totalUsageLimit: number | null;
  perCustomerLimit: number;
  stacking: DiscountStacking;
  priority: number;
  /** `draft` | `active` | `archived` — the STORED lifecycle. The state a shopper
   *  actually experiences also depends on the schedule; see `discountState`. */
  status: string;
  usageCount: number;
  updatedAt: string;
}

export interface DiscountRow {
  id: string;
  code: string | null;
  name: string;
  type: DiscountType;
  scope: DiscountScope;
  valueCents: number | null;
  valuePercent: number | null;
  currency: string | null;
  status: string;
  startAt: string | null;
  endAt: string | null;
  usageCount: number;
  totalUsageLimit: number | null;
  updatedAt: string;
}

export const discountKeys = {
  all: ['commerce', 'discounts'] as const,
  detail: (id: string) => [...discountKeys.all, id] as const,
};

/* ── The list window ────────────────────────────────────────────────────── */

export type SortDir = 'asc' | 'desc';

/** Columns the list may be ordered by. A SUBSET of the server whitelist
 *  (`DiscountSortField` in the discount service) — the ones this table exposes
 *  a header for. The server rejects anything off its list, so a typo here fails
 *  loudly rather than silently sorting by nothing. */
export type DiscountSort = 'name' | 'code' | 'status' | 'updatedAt';

export interface DiscountsPageParams {
  q?: string;
  /** `active` | `draft` | `archived`; omitted = every discount. */
  status?: string;
  sortBy: DiscountSort;
  order: SortDir;
  take: number;
  skip: number;
}

/**
 * One server-paged, server-sorted window of the discount list.
 *
 * `placeholderData` keeps the previous window on screen while the next loads, so
 * paging and re-sorting never blink the table out to empty and back. The whole
 * window is ONE query — never accumulated pages, never a client-side sort of a
 * loaded window (which would sort one page and call it the answer).
 */
export function useDiscountsList(params: DiscountsPageParams) {
  return useQuery({
    queryKey: [...discountKeys.all, 'list', params],
    queryFn: () =>
      api.list<DiscountRow>('/v1/commerce/discounts', {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        ...(params.status && params.status !== 'all' ? { status: params.status } : {}),
        sort_by: params.sortBy,
        order: params.order,
        take: params.take,
        skip: params.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

/* ── The state a shopper actually sees ──────────────────────────────────── */

/**
 * What this discount is doing RIGHT NOW, in the owner's words.
 *
 * The stored `status` alone is not the whole truth: an "active" discount whose
 * start date has not arrived is not reducing anyone's price yet, and one past
 * its end date has stopped. This folds the schedule in so the badge says what is
 * really happening rather than just what was saved.
 */
export function discountState(discount: {
  status: string;
  startAt: string | null;
  endAt: string | null;
}): { label: string; tone: Tone; detail: string } {
  if (discount.status === 'archived') {
    return {
      label: 'Retired',
      tone: 'neutral',
      detail: 'This discount is switched off and no longer reduces any price.',
    };
  }
  if (discount.status === 'draft') {
    return {
      label: 'Not live',
      tone: 'info',
      detail: 'Saved but switched off — no order gets this discount until you turn it on.',
    };
  }
  const now = Date.now();
  if (discount.startAt && new Date(discount.startAt).getTime() > now) {
    return {
      label: 'Scheduled',
      tone: 'warning',
      detail: 'Switched on, but its start date has not arrived yet.',
    };
  }
  if (discount.endAt && new Date(discount.endAt).getTime() < now) {
    return {
      label: 'Ended',
      tone: 'neutral',
      detail: 'Switched on, but its end date has passed, so it no longer applies.',
    };
  }
  return {
    label: 'Live',
    tone: 'success',
    detail: 'Working now — qualifying orders get this discount at checkout.',
  };
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useDiscount(id: string) {
  return useQuery({
    queryKey: discountKeys.detail(id),
    queryFn: () => api.get<Discount>(`/v1/commerce/discounts/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateDiscounts() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: discountKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: discountKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

/** The exact `CreateDiscountInput` shape, validated against the real schema in
 *  `parseDiscountInput` before it leaves the browser. */
export interface DiscountInput {
  code?: string | null;
  name: string;
  description?: string;
  type: DiscountType;
  scope?: DiscountScope;
  valueCents?: number;
  valuePercent?: number;
  currency?: string;
  conditions?: DiscountCondition[];
  startAt?: string;
  endAt?: string;
  totalUsageLimit?: number;
  perCustomerLimit?: number;
  stacking?: DiscountStacking;
  priority?: number;
}

/**
 * Validate a discount payload against the canonical schema before a write.
 *
 * The same guarantee the collection rule editor makes: whatever the UI built has
 * to satisfy the SAME Zod the server runs, so a shape the server would reject
 * never reaches it. Returns the parsed value or a plain sentence naming the first
 * problem.
 */
export function parseDiscountInput(
  candidate: unknown
): { ok: true; value: DiscountInput } | { ok: false; error: string } {
  const parsed = CreateDiscountInputSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, value: parsed.data };
  const first = parsed.error.issues[0];
  return { ok: false, error: first?.message ?? 'One of the fields is not filled in correctly.' };
}

export function useCreateDiscount() {
  const invalidate = useInvalidateDiscounts();
  return useMutation({
    mutationFn: (input: DiscountInput) =>
      api.post<{ id: string; code: string | null }>('/v1/commerce/discounts', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateDiscount(id: string) {
  const invalidate = useInvalidateDiscounts();
  return useMutation({
    mutationFn: (patch: Partial<DiscountInput>) => api.patch(`/v1/commerce/discounts/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useActivateDiscount(id: string) {
  const invalidate = useInvalidateDiscounts();
  return useMutation({
    mutationFn: () => api.post(`/v1/commerce/discounts/${id}/activate`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Retire (soft-delete) a discount. The server sets status=archived and stamps
 *  deletedAt, so it stops applying but its usage history is kept. */
export function useArchiveDiscount(id: string) {
  const invalidate = useInvalidateDiscounts();
  return useMutation({
    mutationFn: () => api.post(`/v1/commerce/discounts/${id}/archive`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function discountErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
