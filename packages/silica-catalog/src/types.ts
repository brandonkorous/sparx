// The catalog metadata shape — structurally the silica editor's `PaletteItem` /
// `PaletteGroup` (silicaui-builder/react), reproduced here so this package stays
// FREE of the `@wizeworks/silicaui-builder` dependency (it must be importable by
// the storefront render, which never loads the editor). The dashboard host adapter
// narrows `icon` to silica's nominal `IconName` when it wraps these into real
// `PaletteGroup[]` for `host.catalog()`.

import type { Node } from '@wizeworks/silicaui-html';

/** One Insert-palette row: a stable key, a label/icon/hint, and a pure factory
 *  returning a FRESH, id-free `Node` (the engine stamps ids on insert, so a
 *  factory that returns a new tree each call is the contract). */
export interface CatalogItem {
  /** Stable identity for the palette row + the drag payload. */
  key: string;
  label: string;
  /** A silica `IconName` (typed `string` here to avoid the builder dependency —
   *  the dashboard adapter asserts it to `IconName`). */
  icon: string;
  /** One-line description shown under the row. */
  hint?: string;
  /** Build a fresh, id-free node to insert. */
  make: () => Node;
}

/** A labeled group of palette rows — the unit `mergeCatalog(base, { extend })`
 *  appends to silica's default Insert index. */
export interface CatalogGroup {
  key: string;
  label: string;
  items: CatalogItem[];
}
