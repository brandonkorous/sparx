'use client';

// Load the tenant's brand web fonts so a Builder canvas renders the REAL faces.
//
// silica's `<Builder>` / `<EmailBuilder>` canvas draws in the plain workbench DOM,
// and the compiled theme names the brand families on `--font-head` / `--font-sans`
// — but a browser only renders a family it has actually loaded. Without this the
// canvas silently falls back to the workbench's Geist, so a heading set in a
// condensed display face on the live site shows up as plain sans in the editor
// (the "why is the builder font different from the site?" bug).
//
// The live storefront loads the same families with an SSR `<link>` (apps/site);
// here we inject the equivalent client-side. Both build the family list with the
// SHARED `themeFontFamilies` + `brandFontHref` (@sparx/site-themes) so the two can't
// drift on which faces load.
//
// Upsert-only, never removed. The workbench is a multi-pane dock: the site Editor
// and the Email designs surface can be open at once, and BOTH scope to the active
// site's brand — so they resolve the SAME font set and share one `<link>`. Removing
// it on either's unmount would yank the font out from under the other; a lingering
// stylesheet when every editor is closed is harmless (cached, tiny), so we simply
// leave it. Keyed by the shared id so re-mounts and the second pane are idempotent.

import { useEffect } from 'react';
import { brandFontHref } from '@sparx/site-themes';

const LINK_ID = 'sparx-canvas-brand-fonts';

/** Ensure a `<link>` loading the given brand font families is in the document head.
 *  Pass the raw family names (from `themeFontFamilies` — compiled + column backstop,
 *  in any order; `brandFontHref` de-dupes). A set that needs no network load (all
 *  bundled/empty) is a no-op: it never removes a link another open editor relies on. */
export function useCanvasBrandFonts(families: (string | null | undefined)[]): void {
  const href = brandFontHref(families);
  useEffect(() => {
    if (!href) return;
    let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = LINK_ID;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  }, [href]);
}
