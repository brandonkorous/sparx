// The sparx data resolver for silica's engine (docs/118 §4, Stage 3).
//
// Implements the DATA half of silicaui-builder's `BuilderHost` — the two
// `ResolveHost` primitives silicaui-html's `resolveTree` calls at render/publish
// time — by wrapping sparx's proven `runtime.ts` binding spine. This is the
// convergence point the whole engine-adoption plan rests on: the SAME resolution
// that drove sparx's old canvas + storefront now feeds silica's ONE shared
// walker, so preview == production is structural.
//
// The shape mapping (verified against silicaui-html `resolve.ts`):
//   · silica passes only `{ item, index }`; sparx needs the module `root` too, so
//     the host CLOSES OVER `root` (fetched once, up front — the sync-not-async
//     contract) and reconstructs sparx's `Scope` per call.
//   · a `value` node → `resolveBinding` → sparx scalar/formatted value.
//   · a `collection` node → `resolveCollection` → the array; a single record
//     (entity pin / object) becomes a **collection-of-one** so a detail page
//     (buy-box, CMS entry) scopes its descendants to `item.*` with no repeat.
//
// REF SHAPES (see `resolveScoped`). A value ref is a path from the data ROOT
// (`commerce.product.title`, `site.identity.logo`) — sparx qualifies every field the
// picker offers under its source (`toSilicaDataSources`), because a bare field key is a
// ref FRAGMENT: it collides across the sources that share a field shape (silica keys
// picker options by their value) and resolves against nothing at the root. Inside a
// repeat the value lives on `scope.item`, so the source prefix is peeled off; a BARE
// ref (code-authored composites, older trees) is already item-relative and still works.
// Entity-pin / collection-source / action refs (the JSON-encoded Layer-B binds) stay
// ABSOLUTE — they resolve from `__pins` / `__sources`, independent of the enclosing
// item — as do refs already written relative (`item.*` / `index`).
//
// React-free by design (types only from silicaui-html) — the full `BuilderHost`
// (catalog / inspectorPanels / pickAsset / validateClass) is assembled in the
// dashboard studio, which adds this resolver as its data half.

import type { DataScope, Resolved, ResolveHost } from '@wizeworks/silicaui-html';

import { decodeBindingRef } from './binding-ref';
import {
  resolveBindingEx as resolveSparxBindingEx,
  resolvePathEx,
  type DataSources,
  type NodeBinding,
  type PathResolution,
  type Scope,
} from './runtime';

export interface SilicaResolverOptions {
  /** The pre-loaded module data root (`__pins`/`__sources` + module sources) the
   *  resolver reads from — the editor's `buildPreviewData` or the storefront's
   *  `loadBuilderData` builds it once, before any render walk. */
  root: DataSources;
  /** Optional host-side value formatter (price → "$49.00", ISO date → "May 27").
   *  Formatting is 100% host territory in the silica model — the engine only
   *  fills the returned `value`; it never formats. Defaults to identity. */
  format?: (value: unknown, binding: NodeBinding) => unknown;
  /** Optional "bound" chip label for the inspector, keyed by binding. */
  label?: (binding: NodeBinding) => string | undefined;
  /** Drop a bound node whose value resolves to nothing, via silica's `visible:false`
   *  (the engine's one conditional-visibility primitive — no expression language).
   *
   *  This is the EMAIL path's conditional (docs/120): it's what replaces sparx's old
   *  `conditional_block` node, so "Shipping to: {{…}}" / "Reason: {{…}}" / "Your credit
   *  line is {{…}}" appear only when that data exists — a bound section with no `attr`
   *  fills no field, so it acts as a pure show/hide wrapper.
   *
   *  OPT-IN, and off by default, because the live SITE builder relies on the opposite:
   *  a bound node whose value is empty keeps its authored placeholder (a composite's
   *  fallback tile / copy) rather than vanishing from the page. Turning this on
   *  globally would silently delete content from published sites. */
  hideWhenEmpty?: boolean;
}

/** "Resolved to nothing" for `hideWhenEmpty`. Deliberately narrow: `0` and `'0'` are
 *  real values a merchant may want shown (a $0 balance, a zero count), so only
 *  nullish / empty-string / explicit-false / empty-array count as absent. */
function isEmptyValue(value: unknown): boolean {
  if (value == null || value === '' || value === false) return true;
  return Array.isArray(value) && value.length === 0;
}

/** The two required `ResolveHost` primitives, ready to spread into a `BuilderHost`
 *  or hand to `resolveTree(tree, resolver)` directly. */
export type SilicaResolver = Required<Pick<ResolveHost, 'resolveBinding' | 'resolveCollection'>>;

/** Resolve a binding against the enclosing `item` when a scope is active.
 *
 *  Refs come from two authors and are shaped differently, and BOTH must work:
 *   · the picker writes a SOURCE-QUALIFIED path (`commerce.product.title`) — qualified
 *     so option values stay unique and resolve at the root (see `toSilicaDataSources`);
 *   · code-authored composites (and trees authored before that) write the BARE field
 *     key (`title`), which is already item-relative.
 *
 *  Inside a repeat the value lives on `scope.item`, so the source prefix — however many
 *  segments it is (`commerce.product.`, `commerce.collection.products.`) — must come off.
 *  Rather than carry a registry of source keys into every host (the storefront resolver
 *  has the data root, not the catalog), we peel leading segments and take the first that
 *  actually RESOLVES. The full path is tried first, so a genuine `item.foo.bar` nested
 *  read still wins over a coincidental shorter match.
 *
 *  Not found after peeling ⇒ `{found:false}` ⇒ an UNKNOWN ref: the node keeps its authored
 *  content and the engine reports a diagnostic, rather than silently blanking. */
function resolveScoped(scope: Scope, binding: NodeBinding, hasItem: boolean): PathResolution {
  const path = binding.path;
  // Absolute binds (entity pin / collection source / action) and non-path binds are
  // scope-independent; `item.*` / `index` are already written relative.
  if (!hasItem || !path || binding.entity || binding.source || binding.action) {
    return resolveSparxBindingEx(scope, binding);
  }
  if (path === 'index' || path === 'item' || path.startsWith('item.') || path.startsWith('item[')) {
    return resolveSparxBindingEx(scope, binding);
  }
  const segments = path.split('.');
  for (let i = 0; i < segments.length; i += 1) {
    const candidate = resolvePathEx(scope, `item.${segments.slice(i).join('.')}`);
    if (candidate.found) return candidate;
  }
  return { found: false, value: undefined };
}

/** The default host value formatter, covering the two shape gaps between sparx's
 *  resolver data and silica's `fillValue` — shared by the dashboard editor host
 *  AND the storefront render host so they format identically (docs/118 §4):
 *   · an image/file field resolves to a `{ url, alt }` OBJECT, but `fillValue` sets
 *     `<img src>` only from a STRING — so unwrap to the url. An EMPTY url returns
 *     `undefined`, leaving the node's authored `src` (the composite's placeholder
 *     tile) in place rather than blanking it.
 *   · a `price` field resolves to a raw number — render it as currency (formatting
 *     is host territory; a composite binds the number, never a pre-formatted string).
 *  A host can wrap this to add locale/currency awareness. */
export function defaultSilicaFormat(value: unknown, binding: NodeBinding): unknown {
  if (value && typeof value === 'object' && 'url' in (value as Record<string, unknown>)) {
    const url = (value as { url?: unknown }).url;
    return typeof url === 'string' && url ? url : undefined;
  }
  if (typeof value === 'number' && /price/i.test(binding.path ?? '')) {
    return `$${value.toFixed(2)}`;
  }
  return value;
}

/** Build a synchronous sparx resolver over a pre-loaded data root. */
export function createSilicaResolver(opts: SilicaResolverOptions): SilicaResolver {
  const { root, format, label, hideWhenEmpty } = opts;
  const scopeOf = (s: DataScope): Scope => ({ root, item: s.item, index: s.index });

  return {
    // `undefined` (not `{ value: undefined }`) when the ref is UNKNOWN — silica's
    // ResolveHost contract. The engine then keeps the node's AUTHORED content and
    // fires a diagnostic, instead of blanking it. That distinction is the difference
    // between a stale binding announcing itself and a stale binding silently eating
    // a tenant's wordmark (docs/122).
    resolveBinding(ref: string, scope: DataScope): Resolved | undefined {
      const binding = decodeBindingRef(ref);
      const { found, value: raw } = resolveScoped(
        scopeOf(scope),
        binding,
        scope.item !== undefined
      );
      if (!found) return undefined;
      const value = format ? format(raw, binding) : raw;
      const chip = label?.(binding);
      return {
        value,
        ...(chip === undefined ? {} : { label: chip }),
        ...(hideWhenEmpty && isEmptyValue(value) ? { visible: false } : {}),
      };
    },

    resolveCollection(ref: string, scope: DataScope): readonly unknown[] | undefined {
      const binding = decodeBindingRef(ref);
      const { found, value: raw } = resolveScoped(
        scopeOf(scope),
        binding,
        scope.item !== undefined
      );
      // Unknown ref → authored children stay + diagnostic. A KNOWN but empty
      // collection is `[]`, which legitimately renders the empty/placeholder state.
      if (!found) return undefined;
      // `Array.isArray` narrows `unknown` to `any[]`; re-assert the element type so
      // nothing `any`-typed escapes into the engine.
      if (Array.isArray(raw)) return raw as readonly unknown[];
      if (raw == null) return [];
      // Entity pin / single object → collection-of-one (docs/118 §4): repeats
      // once, scoping descendants to `item.*`.
      return [raw];
    },
  };
}
