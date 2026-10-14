// Is a record page still exactly the design the platform gave it?
//
// A record page nobody has published is not missing from the site: the site draws the
// platform's design for it ("Live · standard design" in the page list). While its draft
// is still that design, publishing it would show visitors nothing new, so the Publish
// screen must not count it as waiting. It said "3 other pages are saved and not live
// yet" over a journal's untouched "Each author", which the site was already showing
// (persona issue 947).

import { RECORD_TEMPLATES, recordAddressFor } from '@wizeworks/silica-catalog';
import { stripIds, type Node } from '@wizeworks/silicaui-html';

import { canonicalJson } from './artifact-service';
import { isUntouchedKindPage } from './kind-pages';

interface PageRow {
  recordType: string | null;
  silicaDraftTree: unknown;
  silicaPublishedTree: unknown;
}

/** Never published, and its draft is still the platform's design for it. */
export function showsItsDefault(row: PageRow): boolean {
  if (row.silicaPublishedTree != null || !row.recordType || !row.silicaDraftTree) return false;
  const address = recordAddressFor(row.recordType);
  if (address) {
    const draft = canonicalJson(stripIds(row.silicaDraftTree as Node));
    return draft === canonicalJson(RECORD_TEMPLATES[address.recordType]());
  }
  return isUntouchedKindPage(row.silicaDraftTree);
}
