// A core charge sold as a CHOICE, read back into a real deposit (sparx persona
// issue 057).
//
// A store that had no core deposit fakes one with a choice on the product:
//
//   "Accept Core Charge (+$150)"      the dearer version: ship now, deposit paid
//   "Defer Core Charge"               the part alone: the old part comes first
//
//   "Ship now add $200 core charge"   the same two, in other words
//   "Ship when core received"
//
// Gillett Diesel's catalog has 84 of them under five option names and forty
// spellings, typos included ("recieved", "receivied"). The two versions are one
// part on one shelf, so keeping both splits its stock in two; and the prices on
// them do not follow the words ("add $500" at the SAME price as the version
// without it), so the deposit cannot be read from the price difference. It is
// read from the WORDS, which is what the store promised its buyers, and the
// owner reviews every product before anything changes.
//
// Pure: the review screen, the API and the importer's note read the same answer.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

import { MoneyCents } from './common';

/** An option whose name says it is about the core. */
export function isCoreOptionName(name: string): boolean {
  return /\bcores?\b/i.test(name);
}

/**
 * Which side of a core choice a label is on.
 *
 *  - `deposit`: the buyer pays the core charge and the part ships now.
 *  - `first`: no charge; the part ships after the old part arrives.
 *
 * Null when the words say neither, or both: a label this cannot place is left
 * for the owner, never guessed.
 */
export type CoreChoiceSide = 'deposit' | 'first';

const FIRST_WORDS = /\b(defer|deferred|after|when|once|until)\b/i;
const ARRIVAL_WORDS = /\b(rec[ei]{1,2}v\w*|returned|arrives?|arrived|in hand|back)\b/i;
const DEPOSIT_WORDS = /\b(accept|now|adds?|pay|plus)\b|\+\s*\$?\d/i;

export function coreChoiceSide(label: string): CoreChoiceSide | null {
  const text = label.trim();
  if (text === '') return null;
  const first = /\bdefer/i.test(text) || (FIRST_WORDS.test(text) && ARRIVAL_WORDS.test(text));
  const deposit = DEPOSIT_WORDS.test(text) && !/\bdefer/i.test(text);
  if (first === deposit) return null;
  return first ? 'first' : 'deposit';
}

/**
 * The deposit a label names, in cents, or null when it names none.
 *
 * "add $150 per core $1200 total" is a set of eight injectors sold as one item:
 * the deposit on the ITEM is the total, so when the words say "total" the amount
 * nearest it (the last one) is the one. Otherwise the first amount is.
 */
export function depositInLabel(label: string): number | null {
  const amounts = [...label.matchAll(/\$?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g)].map(
    (match) => {
      const whole = Number((match[1] ?? '0').replace(/,/g, ''));
      const cents = Number((match[2] ?? '0').padEnd(2, '0'));
      return whole * 100 + cents;
    }
  );
  const positive = amounts.filter((cents) => cents > 0);
  if (positive.length === 0) return null;
  return (/\btotal\b/i.test(label) ? positive[positive.length - 1] : positive[0]) ?? null;
}

/** One product whose core charge is a choice today, and what it becomes. */
export interface CoreChoiceCandidate {
  productId: string;
  title: string;
  optionName: string;
  /** The words on the ship-now side and the old-part-first side. */
  depositLabel: string;
  firstLabel: string;
  /** The version that stays: its SKU, stock and pictures carry on. */
  keptVariantId: string;
  keptSku: string;
  /** The versions that stop being sold (one per combination of any other choice). */
  retiredVariantIds: string[];
  /** How many versions the product keeps: one, or one per combination of its
   *  other choices (a size, say), each keeping its own part price. */
  groups: number;
  /** Today's prices, so the owner sees what a buyer pays now on each side. */
  depositSidePriceCents: number;
  firstSidePriceCents: number;
  /** What the part costs on its own: the old-part-first price. */
  suggestedPartPriceCents: number;
  /** The deposit the words name, or null when they name none. */
  suggestedCoreChargeCents: number | null;
  currency: string;
  /** Why this product cannot be changed as it stands, in words for the owner;
   *  null when it can. */
  problem: string | null;
}

export const ConvertCoreChoiceInput = z.object({
  productId: Uuid,
  /** The part's own price, before any deposit. Omitted = each version keeps the
   *  price of its old-part-first side, which is the only choice when the product
   *  has other choices too. */
  partPriceCents: MoneyCents.refine((cents) => cents > 0, 'Give the part a price.').optional(),
  /** The refundable deposit per unit. */
  coreChargeCents: MoneyCents.refine((cents) => cents > 0, 'Give the core deposit an amount.'),
  /** Keep letting buyers send the old part first instead of paying the deposit. */
  offerCoreFirst: z.boolean().default(true),
});
export type ConvertCoreChoiceInput = z.infer<typeof ConvertCoreChoiceInput>;

export const ConvertCoreChoicesInput = z.object({
  conversions: z.array(ConvertCoreChoiceInput).min(1).max(500),
});
export type ConvertCoreChoicesInput = z.infer<typeof ConvertCoreChoicesInput>;

export interface CoreChoiceConversion {
  productId: string;
  title: string;
  /** null when it changed; the reason in words when it did not. */
  problem: string | null;
}
