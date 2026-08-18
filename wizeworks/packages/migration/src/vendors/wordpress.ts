// WordPress.
//
// One file does almost everything: Tools → Export → All content produces a WXR that
// carries posts, pages, categories, tags, authors and the media library manifest. The
// tenant does not have to know what any of that means, and they should never be asked
// to install a plugin to get it.
//
// Deliberately NOT taken from the WXR, and said plainly on the marketing page so it
// cannot be a surprise: comments (we have no comments model, and a tenant leaving
// WordPress is usually leaving comment spam behind too), navigation menus (rebuilt in
// the builder, where they are a layout decision rather than a database table), and
// theme or widget settings (meaningless outside WordPress).

import type { CanonicalEntity, CanonicalRow } from '../canonical';
import { parseWxr } from '../parse/wxr';
import type { VendorAdapter } from '../types';

/** The WXR fan-out, shared with WooCommerce and Squarespace — all three emit the same
 *  document because all three use WordPress's exporter. */
export function wxrEntities(text: string): Partial<Record<CanonicalEntity, CanonicalRow[]>> {
  const document = parseWxr(text);
  const out: Partial<Record<CanonicalEntity, CanonicalRow[]>> = {};
  if (document.content.length > 0) out.content = document.content;
  if (document.media.length > 0) out.media = document.media;
  if (document.categories.length > 0) out.categories = document.categories;
  if (document.redirects.length > 0) out.redirects = document.redirects;
  return out;
}

export const wordpress: VendorAdapter = {
  slug: 'wordpress',
  name: 'WordPress',
  kind: 'cms',
  connector: 'wordpress',
  sources: [
    {
      id: 'wordpress.export',
      entity: 'content',
      label: 'Everything you have written',
      file: 'yoursite.WordPress.2026-01-01.xml',
      where: 'Tools → Export → All content → Download Export File',
      format: 'xml',
      filePattern: /\.wordpress\.[\d-]+\.xml$|wordpress.*\.xml$/i,
      vendorMarker: /wordpress\.org/i,
      required: [],
      yields: ['content', 'media', 'categories', 'redirects'],
      mapAll: wxrEntities,
    },
  ],
};
