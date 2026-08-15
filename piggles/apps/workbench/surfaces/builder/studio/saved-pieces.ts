// Tenant-wide saved pieces, carried into the studio as silica SYMBOLS.
//
// THE PROBLEM. A "saved piece" is tenant-wide — one library, placeable on every
// site the business owns. silica's own saved components are `Site.symbols`, which
// is PER-SITE by construction: the map is part of one `Site` document and persists
// to that property's row. So the two cannot be the same thing, and for a long time
// they were not connected at all: the workbench listed a tenant library the studio
// could not see, and offered an "Edit design" button that deep-linked into the
// studio with a `componentId` the studio ignored.
//
// THE APPROACH. Do not build a parallel component system beside silica's — silica
// already ships the entire thing (a Components board, instance insertion, live
// propagation from a master, per-instance overrides, detach, `enterSymbol`). Instead
// MATERIALIZE each tenant piece into `Site.symbols` under a derived, stable id, and
// route the master back to the tenant library on save. Everything the author touches
// is then silica's real component machinery; "tenant-wide" is a fact about where the
// master is STORED, which is exactly what it should have been.
//
// THE ID IS DERIVED, NOT MINTED. `tenant:<key>` — from the piece's own stable key,
// which is already unique per tenant. It has to be derived rather than random
// because the same piece is materialized independently into every site's document,
// on every load: a minted id would differ per site and per session, so an instance
// saved on Monday would point at nothing on Tuesday. The `tenant:` prefix is also
// what tells the two kinds of symbol apart on the way out — see `partitionSymbols`.
//
// WHAT STAYS PER-SITE. A symbol the author creates with silica's own "Save as
// component" is site-owned and persists to the property, unchanged by any of this.
// Both kinds sit in one map and read identically on the canvas; only their storage
// differs.

import type { Site } from '@wizeworks/silicaui-html';

/** The id namespace that marks a symbol as belonging to the tenant library. Chosen
 *  to be unrepresentable as a silica-minted id (those are opaque tokens with no
 *  colon), so the partition can never mistake one for the other. */
const TENANT_PREFIX = 'tenant:';

/** A silica `SymbolDef`, structurally. Not imported from silicaui-html because this
 *  module only ever reads `name`/`root` and re-emits the same objects; the engine
 *  owns the full shape. */
export interface SymbolLike {
  id: string;
  name: string;
  root: unknown;
}

/** One placeable piece from the tenant library (the `?include=silica` row). */
export interface SilicaPiece {
  key: string;
  name: string;
  group: string;
  icon: string;
  description: string | null;
  version: number;
  root: unknown;
}

/** The symbol id a tenant piece is materialized under. */
export function tenantSymbolId(key: string): string {
  return `${TENANT_PREFIX}${key}`;
}

/** The library key behind a materialized symbol id, or null for a site-owned one. */
export function pieceKeyOf(symbolId: string): string | null {
  return symbolId.startsWith(TENANT_PREFIX) ? symbolId.slice(TENANT_PREFIX.length) : null;
}

/**
 * Merge the tenant library into a site's symbol map, ready to hand to `<Builder>`.
 *
 * The library WINS on collision, and that direction matters: a stale materialized
 * copy may be sitting in the stored per-site map from a previous session (nothing
 * strips it retroactively), and rendering that instead of the current master would
 * quietly show an old design on one site while the others moved on. The library is
 * the master by definition, so it is what the canvas opens on.
 *
 * Trees are deep-cloned. The engine mutates its document in place, so handing it the
 * query cache's own objects would let an edit on the canvas rewrite the cached piece
 * — and every other consumer of that cache entry would then be reading a half-edited
 * master it never asked for.
 */
export function withTenantPieces(site: Site, pieces: readonly SilicaPiece[]): Site {
  if (pieces.length === 0) return site;
  const symbols: Record<string, SymbolLike> = {
    ...(site.symbols as Record<string, SymbolLike> | undefined),
  };
  for (const piece of pieces) {
    const id = tenantSymbolId(piece.key);
    symbols[id] = { id, name: piece.name, root: structuredClone(piece.root) };
  }
  return { ...site, symbols: symbols as never };
}

/** A site's symbols split by owner — what `save` needs to send each half somewhere
 *  different. `site` persists to the property's `silicaDraftSymbols`; `tenant` goes
 *  back to the shared library, one PATCH per piece whose master actually changed. */
export interface SymbolPartition {
  site: Record<string, SymbolLike>;
  tenant: { key: string; symbol: SymbolLike }[];
}

export function partitionSymbols(symbols: Site['symbols']): SymbolPartition {
  const out: SymbolPartition = { site: {}, tenant: [] };
  for (const [id, symbol] of Object.entries((symbols ?? {}) as Record<string, SymbolLike>)) {
    const key = pieceKeyOf(id);
    if (key) out.tenant.push({ key, symbol });
    else out.site[id] = symbol;
  }
  return out;
}

/**
 * The tenant masters whose design actually changed since they were materialized.
 *
 * Saving all of them unconditionally would bump `latestVersion` on every piece in
 * the library on every Save — so a tenant with a dozen pieces would accumulate a
 * dozen junk versions per save, and the version history that exists to show what
 * changed would show nothing but noise. A structural compare is cheap next to a
 * network round trip per piece.
 *
 * Compared by serialized tree, not by identity: `withTenantPieces` already cloned,
 * so identity differs from the first render whether or not anything was edited.
 */
export function changedTenantMasters(
  partition: SymbolPartition,
  original: readonly SilicaPiece[]
): { key: string; name: string; root: unknown }[] {
  const before = new Map(original.map((p) => [p.key, JSON.stringify(p.root)]));
  const beforeName = new Map(original.map((p) => [p.key, p.name]));
  const out: { key: string; name: string; root: unknown }[] = [];
  for (const { key, symbol } of partition.tenant) {
    // A symbol with no `before` is a piece deleted from the library while this
    // editor was open. Re-creating it from a stale materialized copy would
    // resurrect something the author deleted somewhere else, so it is skipped —
    // the instance on the page detaches on next load, which is silica's own
    // behaviour for a missing master and the honest outcome here.
    const prior = before.get(key);
    if (prior === undefined) continue;
    if (prior === JSON.stringify(symbol.root) && beforeName.get(key) === symbol.name) continue;
    out.push({ key, name: symbol.name, root: symbol.root });
  }
  return out;
}
