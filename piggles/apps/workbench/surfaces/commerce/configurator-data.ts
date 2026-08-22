'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE CONFIGURATOR (TEMPLATE) DATA LAYER — catalog-wide
//
// A configurator template is the set of questions a shopper answers when a
// product is built to order, plus the rules between those answers and the price
// each answer adds. The PRODUCT-scoped counterpart lives in products-data.ts
// (a facet pane on one product); THIS layer is the catalog-wide manager — every
// template across every product, one place to find and set them up.
//
// The read + write SHAPES are the product layer's, imported so there is one
// definition the storefront resolver, the product facet and this manager all
// share. What is new here is the catalog-wide LIST and mutation hooks that
// invalidate the catalog window rather than a single product.
//
//   ['commerce','configurator-templates']              root
//   ['commerce','configurator-templates','list',{...}] the list window
//   ['commerce','configurator-templates', id]          one template, in full
//                                                       (shared with the product facet)
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import {
  useConfiguratorTemplate,
  useConfiguratorPreview,
  type ConfiguratorAddOn,
  type ConfiguratorOption,
  type ConfiguratorRule,
  type ConfiguratorTemplate,
  type ConfiguratorTemplateRow,
} from './products-data';

export {
  useConfiguratorTemplate,
  useConfiguratorPreview,
  type ConfiguratorAddOn,
  type ConfiguratorOption,
  type ConfiguratorRule,
  type ConfiguratorTemplate,
  type ConfiguratorTemplateRow,
};

export const templateKeys = {
  all: ['commerce', 'configurator-templates'] as const,
  detail: (id: string) => [...templateKeys.all, id] as const,
};

/* ── The list window ────────────────────────────────────────────────────── */

/** Sort direction, shared by every server-sorted list. */
export type SortDir = 'asc' | 'desc';

/**
 * The columns the templates table may order by — EXACTLY the server's whitelist
 * (`ListTemplatesQuery.sort_by` in api-rest). `product` orders on the owning
 * product's title; `options` orders on how many questions a template asks.
 * Sorting is server-side because a client-side sort of one loaded page silently
 * presents that page as the whole answer.
 */
export type TemplateSort = 'name' | 'product' | 'status' | 'options' | 'updatedAt';

export interface TemplateListFilter {
  q?: string;
  status?: string;
  sortBy: TemplateSort;
  order: SortDir;
  take?: number;
  skip?: number;
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useConfiguratorTemplates(filter: TemplateListFilter) {
  return useQuery({
    queryKey: [...templateKeys.all, 'list', filter] as const,
    queryFn: () =>
      api.list<ConfiguratorTemplateRow>('/v1/commerce/configurator-templates', {
        ...(filter.q?.trim() ? { q: filter.q.trim() } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        sort_by: filter.sortBy,
        order: filter.order,
        take: filter.take ?? 50,
        ...(filter.skip ? { skip: filter.skip } : {}),
      }),
    // Hold the previous window while the next loads, so paging and re-sorting
    // don't blink the table out to empty and back.
    placeholderData: (previous) => previous,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateTemplates() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: templateKeys.all });
    // A template's own detail key sits UNDER the root prefix, so the coarse
    // invalidate above already reaches it — but a docked product facet keys its
    // list separately, so name that too when we know the product.
    if (id) void queryClient.invalidateQueries({ queryKey: templateKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

/** What add-ons a write sends: the picked variant, whether it is on by default,
 *  and an optional price override — the resolved sku/title are stripped. */
export interface ConfiguratorAddOnInput {
  variantId: string;
  defaultIncluded: boolean;
  priceOverrideCents?: number;
}

/** The `CreateConfigurationTemplateInput` shape. At least one question is
 *  required — the server rejects a template with no options. */
export interface CreateTemplateInput {
  productId: string;
  name: string;
  description?: string | null;
  options: ConfiguratorOption[];
  rules?: ConfiguratorRule[];
  addOns?: ConfiguratorAddOnInput[];
}

export function useCreateTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) =>
      api.post<{ id: string }>('/v1/commerce/configurator-templates', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

/** The `UpdateConfigurationTemplateInput` shape. Options/rules/add-ons are each
 *  replaced wholesale when present, so the editor always sends the complete set. */
export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  status?: 'draft' | 'active' | 'archived';
  options?: ConfiguratorOption[];
  rules?: ConfiguratorRule[];
  addOns?: ConfiguratorAddOnInput[];
}

export function useUpdateTemplate(id: string) {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (patch: UpdateTemplateInput) =>
      api.patch(`/v1/commerce/configurator-templates/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteTemplate(id: string) {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: () => api.delete(`/v1/commerce/configurator-templates/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function templateErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
