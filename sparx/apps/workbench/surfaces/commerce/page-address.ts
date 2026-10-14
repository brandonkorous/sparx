// Where a product, collection or category page sits on the owner's site, as the
// line under its "Web address" box prints it.
//
// The path comes from the one table the site's pages are built from
// (`RECORD_ADDRESSES` in @wizeworks/silica-catalog), never typed here. The
// category hint said "/c/", which the site has never served: Gillett's
// "/c/injectors" was a Not Found page (sparx persona issue 225; Piggles fixed
// the same line as its issue 383 and this one was left behind).

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
