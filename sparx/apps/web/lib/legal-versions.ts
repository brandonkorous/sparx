// sparx's legal document versions, for the pages that render them.
//
// The single source of truth is `@wizeworks/legal`, which holds one entry PER
// BRAND — the acceptance recorder used to write sparx's versions against every
// tenant regardless of which product they signed up through, and keying it by
// brand is what fixed that. These pages are sparx's, so they pin sparx's entry
// once here rather than passing a brand string on every page.

import { brandLegal, type LegalDocVersion } from '@wizeworks/legal';

const SPARX = brandLegal('sparx');

/** Versions for the four documents sparx publishes. Non-optional at this alias:
 *  sparx publishes all four, so a missing one is a mistake worth failing on
 *  rather than rendering a page with no effective date. */
export const LEGAL_DOC_VERSIONS = SPARX.versions as Record<
  'terms' | 'privacy' | 'dpa' | 'aup',
  LegalDocVersion
>;

export const SUBPROCESSORS_VERSION = SPARX.subprocessors;

export type { LegalDocVersion, LegalDocType } from '@wizeworks/legal';
