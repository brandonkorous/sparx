'use client';

// ══════════════════════════════════════════════════════════════════════════
// MARKUP RULES: how a cost becomes a price (sparx persona issue 086).
//
// A rule says "add 40% to what it cost me" once, and is then picked on a quote
// line, or bound to products in the catalog, instead of working each price out
// by hand. The API has always had full create, edit and delete; no screen did.
//
//   ['commerce','markup-rules']            the root every read nests under
//   ['commerce','markup-rules', id]        one rule
//   ['commerce','markup-rules', id, 'preview'] what Apply would do to the catalog
//
// Two other screens hold their own copy of the list, and a change here has to
// reach both: the quote editor's line composer and a product's Pricing tab.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';
import { apiErrorMessage } from '../../lib/api-error';
import type { MarkupScope } from '@wizeworks/commerce-schemas';
import type { MarkupRuleRow, RulePayload } from './markup-rule-words';

export const markupRuleKeys = {
  all: ['commerce', 'markup-rules'] as const,
  detail: (id: string) => [...markupRuleKeys.all, id] as const,
  preview: (id: string) => [...markupRuleKeys.all, id, 'preview'] as const,
};

/** The other screens' copies of the rule list (see the header). */
const OTHER_COPIES = [
  ['invoicing', 'markup-rules'],
  ['commerce', 'products', 'markup-rules'],
] as const;

export function useMarkupRuleList() {
  return useQuery({
    queryKey: markupRuleKeys.all,
    queryFn: () => api.get<MarkupRuleRow[]>('/v1/markup-rules'),
  });
}

export function useMarkupRule(id: string) {
  return useQuery({
    queryKey: markupRuleKeys.detail(id),
    queryFn: () => api.get<MarkupRuleRow>(`/v1/markup-rules/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

function useInvalidateRules() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: markupRuleKeys.all });
    for (const key of OTHER_COPIES) void queryClient.invalidateQueries({ queryKey: key });
    if (id) void queryClient.invalidateQueries({ queryKey: markupRuleKeys.detail(id) });
  };
}

export function useCreateMarkupRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: (input: RulePayload) => api.post<MarkupRuleRow>('/v1/markup-rules', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateMarkupRule(id: string) {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: (input: RulePayload) => api.patch<MarkupRuleRow>(`/v1/markup-rules/${id}`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteMarkupRule(id: string) {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: () => api.delete(`/v1/markup-rules/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── The catalog: what Apply would do, and doing it ─────────────────────── */

export interface MarkupPreviewLine {
  variantId: string;
  productId: string;
  sku: string;
  title: string | null;
  costCents: number | null;
  currentPriceCents: number;
  newPriceCents: number | null;
  marginPct: number | null;
  unpriceable: boolean;
}

export interface MarkupPreview {
  ruleId: string;
  scope: MarkupScope;
  totalVariants: number;
  pricedVariants: number;
  unpriceableVariants: number;
  truncated: boolean;
  lines: MarkupPreviewLine[];
}

export interface MarkupApplyResult {
  applied: number;
  skipped: number;
  capped: boolean;
}

/** A dry run. It writes nothing, so it is safe to ask for whenever the
 *  catalog section is open. */
export function useMarkupPreview(id: string, enabled: boolean) {
  return useQuery({
    queryKey: markupRuleKeys.preview(id),
    queryFn: () => api.post<MarkupPreview>(`/v1/markup-rules/${id}/preview`, {}),
    enabled: enabled && id !== 'new',
  });
}

export function useApplyMarkupRule(id: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: () => api.post<MarkupApplyResult>(`/v1/markup-rules/${id}/apply`, {}),
    onSuccess: () => {
      invalidate(id);
      void queryClient.invalidateQueries({ queryKey: markupRuleKeys.preview(id) });
      // Every product it touched has a new price.
      void queryClient.invalidateQueries({ queryKey: ['commerce', 'products'] });
    },
  });
}

export function markupRuleErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
