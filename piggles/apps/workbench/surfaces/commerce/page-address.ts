// Where a product, collection or category page sits on the owner's site, as the
// line under its "Web address" box prints it.
//
// The path comes from the one table the site's pages are built from
// (`RECORD_ADDRESSES` in @wizeworks/silica-catalog), never typed here. This
// console's category hint once said "/c/", which the site has never served
// (issue 383); fixed here by hand, it stayed wrong in the sparx console until
// sparx persona issue 225, and every hint said "yoursite.com" in both.

import { recordAddressFor } from '@wizeworks/silica-catalog';

export type AddressedRecord = 'commerce.product' | 'commerce.collection' | 'commerce.category';

/**
 * "gillettdiesel.sparx.zone/category/injectors". With no address known yet, the
 * path alone ("/category/injectors"), never a made-up one.
 */
export function pageAddress(
  host: string | null,
  record: AddressedRecord,
  handle: string
): string {
  const prefix = recordAddressFor(record)?.prefix ?? '/';
  return `${host ?? ''}${prefix}${handle || '…'}`;
}
