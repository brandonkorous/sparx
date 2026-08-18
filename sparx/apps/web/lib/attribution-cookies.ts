// sparx's own attribution cookie names.
//
// The names are FIXED, forever: they are already set in the browsers of everyone
// who has ever visited sparx.works, and renaming one silently discards that
// person's recorded first touch. `attrCookies('sparx')` reproduces exactly the
// four names that were hardcoded in @wizeworks/attribution before a second brand
// existed — see that file for why the package no longer names either brand.

import { attrCookies } from '@wizeworks/attribution';

export const SPARX_ATTR = attrCookies('sparx');
