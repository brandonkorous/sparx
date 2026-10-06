// What picking a product puts on an invoice line, and how a search result reads.
//
// The line editor picks a VERSION in one search (sparx persona issue 077). It
// used to pick a product from the first 100 of the catalog and then ask which
// version, and both halves went wrong on a parts counter with 653 products:
//
//   · the part's own code, typed into the search, found nothing, because the
//     part sat 468th and the search only looked at the first 100;
//   · the near-identical part that WAS in the first 100 ("…(0986435521)", one
//     digit off) got picked instead, at its own $635.00;
//   · a second "which version" box appeared for a part with ONE version on
//     sale, because the count included the version retired that morning;
//   · and the line read "Bosch Remanufactured Fuel Injector (0986435621)
//     (0986435621)", the code appended to a name that already carried it.
//
// The search is the server's now (`useVariantSearch`, the same one the till and
// the bundle picker use since issue 069), and everything a row or a line says is
// decided here, in one place, with a test.

import type { PickerRow } from '../../components/search-picker';
import type { VariantChoice } from '../commerce/bundles-data';
import { formatMoney } from './types';

/** What a line takes from the version picked. */
export interface ProductPick {
  productId: string;
  variantId: string | null;
  /** The line's description: the product's name, plus only what it lacks. */
  description: string;
  /** Dollars: the catalog price. A trade price, when one applies, replaces it. */
  unitPrice: number;
  /** Dollars per unit: the version's refundable core deposit, null for none, or
   *  absent when not known here (the server then takes the part's own). */
  coreCharge?: number | null;
  /** Cents: what it costs the business, or null; the line's cost (issue 086). */
  costCents: number | null;
}

/** What tells this version from its siblings: its own name, else its options. */
export function versionName(variant: VariantChoice): string {
  const title = variant.title?.trim() ?? '';
  if (title) return title;
  return variant.options
    .map((option) => option.value.trim())
    .filter(Boolean)
    .join(' · ');
}

/** True when `text` already says `part`, whatever its case. */
function says(text: string, part: string): boolean {
  return text.toLowerCase().includes(part.toLowerCase());
}

/**
 * The line's description: the product's name, then in brackets only what that
 * name does not already say. A version name ("Case of 12") is added when the
 * product has more than one; the code is added when the name lacks it, and
 * never twice.
 */
export function lineDescription(variant: VariantChoice): string {
  const name = variant.productTitle.trim();
  const version = versionName(variant);
  const code = variant.sku.trim();
  const extra = [
    version && !says(name, version) ? version : '',
    code && !says(name, code) && !says(version, code) ? code : '',
  ].filter(Boolean);
  return extra.length > 0 ? `${name} (${extra.join(', ')})` : name;
}

/** Retired products stay off a new line; a draft can still be quoted. */
export function pickable(variant: VariantChoice): boolean {
  return variant.productStatus !== 'archived' && variant.archivedAt === null;
}

/**
 * One search result: the product's name first, because that is what a person
 * recognises, then the version, the code when the name does not carry it, and
 * the price. Two parts one digit apart now read as two different codes.
 */
export function pickerRowFor(variant: VariantChoice): PickerRow {
  const name = variant.productTitle.trim();
  const version = versionName(variant);
  const code = variant.sku.trim();
  const secondary = [
    version,
    code && !says(name, code) && !says(version, code) ? code : '',
    formatMoney(variant.priceCents / 100, variant.currency),
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    id: variant.id,
    primary: name,
    secondary,
    mark: variant.productStatus === 'draft' ? { label: 'Not on sale', color: 'info' } : null,
  };
}

/** What the line takes from the version picked. */
export function pickFrom(variant: VariantChoice): ProductPick {
  return {
    productId: variant.productId,
    variantId: variant.id,
    description: lineDescription(variant),
    unitPrice: variant.priceCents / 100,
    coreCharge: variant.coreChargeCents === null ? null : variant.coreChargeCents / 100,
    costCents: variant.costCents ?? null,
  };
}

/**
 * The linked product's name for the badge under a line, or null when the badge
 * would only repeat the description.
 *
 * Picking a part writes its name as the description, so on every line picked
 * and left alone the badge said the same words a second time, right under
 * them (sparx persona issue 083). It earns its place when the description was
 * changed: then it is the only thing on the row saying which product the line
 * still draws its stock and price from.
 */
export function linkedProductBadge(line: {
  productId?: string | null;
  productLabel?: string | null;
  description: string;
}): string | null {
  if (!line.productId) return null;
  if (!line.productLabel) return 'Linked product';
  return line.productLabel.trim() === line.description.trim() ? null : line.productLabel;
}
