// A starter silica `Document` for the engine-adoption studio (docs/118). Until the
// re-seed lands silica-native `Site`s in the store (no backfill — the tenant trees
// are regenerated, not converted), the new `<Builder>` mount opens on this starter
// so the whole seam — palette, canvas, binding picker, class policy — is provable
// end-to-end against real engine data.
//
// The page composes sparx's commerce catalog (a product grid + a featured rail)
// with a silica marketing block (a split hero) so the merged Insert palette
// (silica defaults + `COMMERCE_CATALOG`) is visible in one page. Every node is
// stamped with a fresh id — `<Builder>` edits an id-carrying document, not an
// id-free template.

import {
  pageBody,
  stampTree,
  THEME_PRESETS,
  type Document,
  type Theme,
} from '@wizeworks/silicaui-html';
import { heroSplitCta } from '@wizeworks/silicaui-html/blocks';
import { collectionHeader, featuredProducts, productGrid } from '@sparx/silica-catalog';

/** A fresh, fully-id'd starter document: a themed single page of the sparx commerce
 *  composites beneath a silica hero. Pass the tenant's silica `Theme`
 *  (`compiledToSilicaTheme` of its compiled brand) so the canvas previews the real
 *  brand; falls back to a shipped preset when none is supplied. */
export function starterSilicaDocument(theme: Theme = THEME_PRESETS[0]!): Document {
  const root = stampTree(
    pageBody([
      // silica's own block — proves the DEFAULT catalog renders beside sparx's.
      heroSplitCta.root,
      collectionHeader(),
      productGrid(),
      featuredProducts(),
    ])
  );
  return { version: '1.0.0', root, theme };
}
