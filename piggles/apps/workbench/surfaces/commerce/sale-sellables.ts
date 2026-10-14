'use client';

// Everything that can go on a sale at the counter: the catalog and the diary,
// in one list. Moved out of sale-data.ts unchanged (sparx persona issue 230).

import { useMemo } from 'react';
import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { useModuleStates } from '../../lib/api/shell-data';
import { useVariantSearch, type VariantChoice } from './bundles-data';
import { coreFieldsFrom } from './sale-core';
import type { Sellable } from './sale-data';

interface ServiceRow {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
}

/** Her diary services, which are the things a salon actually sells. Skipped when
 *  the module is off — an absent list, never an error on a till. */
function useSellableServices() {
  const modules = useModuleStates();
  const on = modules.data?.some((m) => m.slug === 'scheduling' && m.enabled) ?? false;
  return useQuery({
    queryKey: ['commerce', 'sale', 'services'] as const,
    queryFn: () => api.list<ServiceRow>('/v1/scheduling/services', { activeOnly: true, take: 250 }),
    enabled: on,
    staleTime: 5 * 60_000,
  });
}

/**
 * What tells this version apart from the others, at a counter (issue 182).
 *
 * A ladder, because any one rung can be empty and a picker must never draw two
 * rows a person cannot tell apart: the option values as she would say them out
 * loud ("L · Oat"), else whatever the version is named, else the SKU off the
 * label. The default version of a single-version product returns null — there is
 * nothing to distinguish it from.
 */
function variantDetail(v: VariantChoice): string | null {
  const options = v.options.map((o) => o.value.trim()).filter(Boolean);
  if (options.length > 0) return options.join(' · ');
  const title = v.title?.trim();
  if (title) return title;
  return v.isDefault ? null : v.sku;
}

function serviceSku(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `SERVICE-${slug || 'item'}`.slice(0, 60);
}

/**
 * Everything sellable, in one list, products and services together.
 *
 * She does not think "catalog" and "diary" — she thinks a bottle of shampoo and
 * a bond-repair treatment, and both go on the same receipt.
 */
export function useSellables(search: string) {
  // What is typed goes to the server, so a part past the first window is as
  // findable as the first (sparx persona P01, issue 069: 693 versions, and
  // everything after roughly the 500th alphabetically could not be sold here).
  // Services are a short list of their own and are filtered where they are drawn.
  const variants = useVariantSearch(search);
  const services = useSellableServices();

  const items = useMemo<Sellable[]>(() => {
    const fromProducts = (variants.data ?? [])
      .filter((v) => v.productStatus !== 'archived')
      .map<Sellable>((v) => ({
        key: `variant:${v.id}`,
        kind: 'product',
        name: v.productTitle,
        detail: variantDetail(v),
        priceCents: v.priceCents,
        currency: v.currency,
        sku: v.sku,
        keywords: v.title,
        productId: v.productId,
        variantId: v.id,
        orderAheadDays: v.orderAheadDays,
        deposit: v.deposit,
        ...coreFieldsFrom(v),
      }));

    const fromServices = (services.data?.items ?? []).map<Sellable>((s) => ({
      key: `service:${s.id}`,
      kind: 'service',
      name: s.name,
      detail: s.durationMinutes > 0 ? `${s.durationMinutes} minutes` : null,
      priceCents: s.priceCents,
      currency: s.currency,
      sku: serviceSku(s.name),
    }));

    return [...fromServices, ...fromProducts].sort((a, b) => a.name.localeCompare(b.name));
  }, [variants.data, services.data]);

  return {
    items,
    isPending: variants.isPending || (services.isFetching && services.data === undefined),
    isError: variants.isError,
    /** The rows in hand answer an older search; never call them "no match". */
    searching: variants.searching,
    retry: variants.retry,
  };
}
