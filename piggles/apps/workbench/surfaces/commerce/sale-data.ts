'use client';

// Selling something to somebody standing in front of you.
//
// `POST /v1/orders` has always existed and no screen in either console called
// it. The Orders list said, in its own comment, "orders arrive from customers,
// they are not something you create here" — true of a shop, false of a salon, a
// bakery, a garage or a therapist, which is most of who this is for. The money
// they take is taken in the room, and none of it could be written down.
//
// This file is what a sale is made of and what its customer pays. What can be
// put on one is `sale-sellables.ts`; writing it down is `sale-take.ts`.

import { useMutation } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import type { ProductDeposit } from './made-to-order-data';
import type { CoreOffer } from './sale-core';

/** Anything the business can put on a sale: a thing off the shelf, or an hour of
 *  its own time. Both are lines on the same receipt, so both live in one list. */
export interface Sellable {
  key: string;
  kind: 'product' | 'service';
  name: string;
  /** The version, the length of the appointment — what tells two apart. */
  detail: string | null;
  priceCents: number;
  currency: string;
  sku: string;
  /** Searched, never drawn: a version's own name when the row shows its options. */
  keywords?: string | null;
  productId?: string;
  variantId?: string;
  /** Days of notice this needs before it can be handed over. Null for anything
   *  off a shelf, and for every service (a booking carries its own). */
  orderAheadDays?: number | null;
  deposit?: ProductDeposit;
  /** A rebuilt part's core deposit, and whether its old part may come first
   *  (sparx issue 061). Absent on everything that takes no core. */
  core?: CoreOffer;
}

/** One line as it is being built. `sellable` is null for a hand-typed line. */
export interface SaleLine {
  id: string;
  name: string;
  quantity: number;
  /** Whole currency units, as typed. */
  price: string;
  sku: string;
  productId: string | null;
  variantId: string | null;
  /** Days of notice, carried from the catalog so the sale knows its own due
   *  day. Null on a hand-typed line — nobody said, so nothing is claimed. */
  orderAheadDays: number | null;
  /** How much of this line the shop asks for up front. Absent on a hand-typed
   *  line, which is taken in full like everything else. */
  deposit?: ProductDeposit;
  /** Has she typed over the price? Until she does, the line follows whatever
   *  this customer's agreed price turns out to be; after, her number stands and
   *  the row says what the agreed one was. The payment box in the same pane has
   *  worked this way since it was written. [[feedback_honor_the_users_choice]] */
  priceTouched: boolean;
  /** What this line costs this customer, as the pricing engine resolves it, and
   *  why. Absent until the answer arrives, and on a hand-typed line forever —
   *  nothing in the catalog to price. */
  agreed?: AgreedPrice;
  /** The version's core deposit, carried from the catalog. Absent on anything
   *  that takes no core, including every hand-typed line (sparx issue 061). */
  core?: CoreOffer;
  /** The buyer will bring the old part first instead of paying the deposit.
   *  Absent or false means the deposit is paid, which is the default. */
  coreFirst?: boolean;
}

/** One line's answer from the pricing engine: the figure, the figure it would
 *  have been, and the rule that changed it. */
export interface AgreedPrice {
  unitPriceCents: number;
  /** Before any rule applied. The trace's first step, which is the variant's own
   *  price or, for a set, what its parts come to. */
  listPriceCents: number;
  /** The last rule that moved the price, in her words. Null when nothing did. */
  why: string | null;
}

/**
 * The rule that set the price, said the way a shop owner would say it.
 *
 * Only the LAST step that actually moved the number is named: a price walked
 * down by an agreement and then a bulk break is, to her, a bulk price. The
 * sources are `PriceTraceStep.source` in commerce-schemas; the two that can
 * only be the starting figure are deliberately absent, because "this is the
 * price you set" is not a reason worth a line of text.
 *
 * Lower case and a NOUN PHRASE, because the row uses each of these two ways:
 * as a tag of its own ("Their agreed price · normally $96.00") and inside a
 * sentence ("They pay $52.00, their agreed price."). A phrase that only reads
 * in one of those gave "Their their agreed price" the first time.
 */
const WHY: Record<string, string> = {
  contract_price: 'their agreed price',
  b2b_pricing_tier: 'their wholesale price',
  price_list: 'the price on a list they are on',
  bulk_tier: 'a bulk price at this quantity',
  subscribe_and_save: 'their subscription rate',
};

/** The starting figure, whatever it was called. A set is priced from its parts,
 *  so its wrapper variant's own number is never the one to compare against. */
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
 * A mutation rather than a query because the question is asked at moments, not
 * continuously: a line goes on, a quantity changes, the customer changes. A
 * query keyed on the basket would re-ask on every keystroke in the price box,
 * which is the one moment the answer must not arrive.
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
