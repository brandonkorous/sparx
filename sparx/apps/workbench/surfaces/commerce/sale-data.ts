'use client';

// Selling something to somebody standing in front of you. Sparx persona issue 061.
//
// `POST /v1/orders` has always existed, and in this console nothing called it:
// the Orders list described orders as something customers place, never something
// the business writes down. True of a website, false of a parts counter, a
// salon, a garage or a bakery, where the buyer pays at the counter and walks out
// with the part. None of that money could be recorded here, so it was missing
// from Orders, from Payments, from what is owed and from the takings, and a
// rebuilt part sold that way had no core deposit and no core owed.
//
// Piggles has had this screen since its own persona pass (its `commerce.sale.new`).
// This is the same errand built in this console's idiom, and it learned the core
// deposit first.

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { useModuleStates } from '../../lib/api/shell-data';
import { ORDERS_KEY, type Order } from './data';
import { useVariantSearch, type VariantChoice } from './bundles-data';
import { coreFieldsFrom, handedOverNow, saleItem, type CoreOffer } from './sale-core';

/** Anything the business can put on a sale: a thing off the shelf, or an hour of
 *  its own time. Both are lines on the same receipt, so both live in one list. */
export interface Sellable {
  key: string;
  kind: 'product' | 'service';
  name: string;
  /** The version, the length of the appointment: what tells two apart. */
  detail: string | null;
  priceCents: number;
  currency: string;
  sku: string;
  /** Searched, never drawn: a version's own name when the row shows its options. */
  keywords?: string | null;
  productId?: string;
  variantId?: string;
  /** A rebuilt part's core deposit, and whether its old part may come first.
   *  Absent on everything that takes no core. */
  core?: CoreOffer;
}

/** One line as it is being built. `variantId` is null on a hand-typed line. */
export interface SaleLine {
  id: string;
  name: string;
  quantity: number;
  /** Whole currency units, as typed. */
  price: string;
  sku: string;
  productId: string | null;
  variantId: string | null;
  /** Has the price been typed over? Until it is, the line follows whatever this
   *  customer's agreed price turns out to be; after, the typed number stands and
   *  the row says what the agreed one was. [[feedback_honor_the_users_choice]] */
  priceTouched: boolean;
  /** What this line costs this customer, as the pricing engine resolves it, and
   *  why. Absent until the answer arrives, and forever on a hand-typed line. */
  agreed?: AgreedPrice;
  /** The version's core deposit, carried from the catalog. Absent on anything
   *  that takes no core, including every hand-typed line. */
  core?: CoreOffer;
  /** The buyer will bring the old part first instead of paying the deposit.
   *  Absent or false means the deposit is paid, which is the default. */
  coreFirst?: boolean;
}

/** One line's answer from the pricing engine: the figure, the figure it would
 *  have been, and the rule that changed it. */
export interface AgreedPrice {
  unitPriceCents: number;
  /** Before any rule applied: the trace's first step, the version's own price. */
  listPriceCents: number;
  /** The last rule that moved the price, in the owner's words. Null when none did. */
  why: string | null;
}

/**
 * The rule that set the price, said the way an owner would say it.
 *
 * Only the LAST step that actually moved the number is named: a price walked down
 * by an agreement and then a bulk break is, to the person at the counter, a bulk
 * price. Lower case and a noun phrase, because the row uses each of these both as
 * a tag of its own and inside a sentence (see sale-price-note.ts).
 */
const WHY: Record<string, string> = {
  contract_price: 'their agreed price',
  b2b_pricing_tier: 'their wholesale price',
  price_list: 'the price on a list they are on',
  bulk_tier: 'a bulk price at this quantity',
  subscribe_and_save: 'their subscription rate',
};

/** The starting figure, whatever it was called. A set is priced from its parts,
 *  so its wrapper version's own number is never the one to compare against. */
const A_STARTING_FIGURE = new Set(['variant_base', 'bundle_price']);

interface PricedLineResponse {
  variantId: string;
  quantity: number;
  unitPriceCents: number;
  trace: { source: string; resultingUnitPriceCents: number }[];
}

function readAgreed(line: PricedLineResponse): AgreedPrice {
  const first = line.trace[0];
  const moved = [...line.trace].reverse().find((step) => !A_STARTING_FIGURE.has(step.source));
  return {
    unitPriceCents: line.unitPriceCents,
    listPriceCents: first ? first.resultingUnitPriceCents : line.unitPriceCents,
    why: moved ? (WHY[moved.source] ?? null) : null,
  };
}

/**
 * What this customer pays for these things, on this site, today.
 *
 * A wholesale customer with agreed prices is the whole reason this exists: the
 * catalog price is the walk-in's price, and a shop on account must be charged at
 * the counter what the website would charge it.
 *
 * A mutation rather than a query because the question is asked at moments: a line
 * goes on, a quantity changes, the customer changes. A query keyed on the basket
 * would re-ask on every keystroke in the price box.
 */
export function useAgreedPrices() {
  return useMutation({
    mutationFn: async (input: {
      customerId: string;
      propertyId: string | null;
      lines: { variantId: string; quantity: number }[];
    }): Promise<Map<string, AgreedPrice>> => {
      if (input.lines.length === 0) return new Map();
      const priced = await api.post<PricedLineResponse[]>('/v1/commerce/pricing/quote', {
        customerId: input.customerId,
        channel: 'admin',
        currency: 'USD',
        ...(input.propertyId ? { property_id: input.propertyId } : {}),
        lines: input.lines,
      });
      return new Map(priced.map((line) => [line.variantId, readAgreed(line)]));
    },
  });
}

interface ServiceRow {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
}

/** The bookable services, which a garage sells by the hour beside its parts.
 *  Skipped when scheduling is off: an absent list, never an error on a till. */
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
 * rows nobody can tell apart: the option values as said out loud, else whatever
 * the version is named, else the code on the box. The default version of a
 * single-version product returns null: there is nothing to tell it from.
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
 * Everything sellable, in one list, parts and services together.
 *
 * Nobody at a counter thinks "catalog" and "diary". They think an injector and an
 * hour of labor fitting it, and both go on the same receipt.
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
      .filter((v) => v.archivedAt === null && v.productStatus !== 'archived')
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
        ...coreFieldsFrom(v),
      }));

    const fromServices = (services.data?.items ?? []).map<Sellable>((s) => ({
      key: `service:${s.id}`,
      kind: 'service',
      name: s.name,
      detail: s.durationMinutes > 0 ? `${String(s.durationMinutes)} minutes` : null,
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

export interface TakeSaleInput {
  customerId: string;
  currency: string;
  lines: SaleLine[];
  /** Whole currency units taken now. Zero means nothing has been paid yet. */
  paid: number;
  paidWith: string;
  paidNote: string;
  /** Which business this was sold at. Without it the order has no origin site,
   *  and every site-scoped money screen leaves it out of the totals while the
   *  order itself reads perfectly. */
  propertyId: string | null;
}

/** The same rate ref checkout writes when a shopper chooses to collect, so the
 *  order pane reads a counter sale as collected and stops offering a carrier, a
 *  tracking number and a warehouse walk. See `deliveryPlan` in data.ts. */
const COLLECTION_RATE_REF = 'collection:in-person';

async function handOver(order: Order): Promise<void> {
  const lines = handedOverNow(order.items ?? []);
  if (lines.length === 0) return;
  await api.post(`/v1/orders/${order.id}/fulfillments`, {
    status: 'delivered',
    carrier: 'pickup',
    lines,
  });
}

/**
 * Writes the sale down, the money against it, and the handover.
 *
 * Three calls because the platform stores three facts, and they are separate on
 * purpose: a part payment and an unpaid slip are both ordinary. The order goes
 * first: if a later call fails the order still exists and can be settled from its
 * own pane, whereas a payment with no order has nothing to belong to.
 *
 * The handover covers everything that leaves with the buyer. A sale at a counter
 * is over when it is made, and without it every one would sit in "To pack"
 * forever, waiting on a despatch that already happened by hand. A part held for
 * its old part is the exception: it stays on the order, waiting, exactly as it
 * would had it been bought on the website.
 */
export function useTakeSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TakeSaleInput): Promise<Order> => {
      const order = await api.post<Order>('/v1/orders', {
        customerId: input.customerId,
        currency: input.currency,
        channel: 'admin',
        source: 'till',
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        metadata: {
          shippingRateRef: COLLECTION_RATE_REF,
          shippingDescription: 'Taken at the counter',
        },
        items: input.lines.map(saleItem),
      });
      if (input.paid > 0) {
        await api.post(`/v1/orders/${order.id}/payments`, {
          amount: input.paid,
          currency: input.currency,
          processor: input.paidWith,
          status: 'captured',
          capturedAt: new Date().toISOString(),
          // `metadata`, not `processorRef`: a check number is not a gateway
          // reference, and the order pane reads the note from here.
          ...(input.paidNote.trim() ? { metadata: { note: input.paidNote.trim() } } : {}),
        });
      }
      await handOver(order);
      return order;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}
