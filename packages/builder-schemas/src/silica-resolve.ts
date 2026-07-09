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
// SCOPE-RELATIVE refs (silica's binding model — data-sources.ts / the Inspector's
// `scopeAt` + `flattenSources`): inside a scope the built-in picker writes a
// field's OWN key (`title`, `items`), NOT a root path, and the engine passes
// `scope.item`. So when `scope.item` is present a bare-path ref is item-relative
// — we prefix `item.` before handing it to sparx's `resolvePath`. Entity-pin /
// collection-source / action refs (the JSON-encoded Layer-B binds) stay ABSOLUTE
// (they resolve from `__pins` / `__sources`, independent of the enclosing item),
// as do refs already written relative (`item.*` / `index`).
//
// React-free by design (types only from silicaui-html) — the full `BuilderHost`
// (catalog / inspectorPanels / pickAsset / validateClass) is assembled in the
// dashboard studio, which adds this resolver as its data half.

import type { DataScope, Resolved, ResolveHost } from '@wizeworks/silicaui-html';

import { decodeBindingRef } from './binding-ref';
import {
  resolveBinding as resolveSparxBinding,
  type DataSources,
  type NodeBinding,
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
}

/** The two required `ResolveHost` primitives, ready to spread into a `BuilderHost`
 *  or hand to `resolveTree(tree, resolver)` directly. */
export type SilicaResolver = Required<Pick<ResolveHost, 'resolveBinding' | 'resolveCollection'>>;

/** Re-root a bare-path binding to the enclosing `item` when a scope is active.
 *  silica's picker writes scope-relative field keys (`title`, `items`) inside a
 *  repeat; sparx's `resolvePath` reads `item.*` off `scope.item`, so we prefix.
 *  Absolute binds (entity pin / collection source / action) and refs already
 *  written relative (`item.*` / `index`) pass through untouched. */
function scopeRelative(binding: NodeBinding, hasItem: boolean): NodeBinding {
  if (!hasItem) return binding;
  const path = binding.path;
  if (!path || binding.entity || binding.source || binding.action) return binding;
  if (path === 'index' || path === 'item' || path.startsWith('item.') || path.startsWith('item[')) {
    return binding;
  }
  return { ...binding, path: `item.${path}` };
}

/** Build a synchronous sparx resolver over a pre-loaded data root. */
export function createSilicaResolver(opts: SilicaResolverOptions): SilicaResolver {
  const { root, format, label } = opts;
  const scopeOf = (s: DataScope): Scope => ({ root, item: s.item, index: s.index });
  const bindingOf = (ref: string, scope: DataScope): NodeBinding =>
    scopeRelative(decodeBindingRef(ref), scope.item !== undefined);

  return {
    resolveBinding(ref: string, scope: DataScope): Resolved {
      const binding = bindingOf(ref, scope);
      const raw = resolveSparxBinding(scopeOf(scope), binding);
      const value = format ? format(raw, binding) : raw;
      const chip = label?.(binding);
      return chip === undefined ? { value } : { value, label: chip };
    },

    resolveCollection(ref: string, scope: DataScope): readonly unknown[] {
      const binding = bindingOf(ref, scope);
      const raw = resolveSparxBinding(scopeOf(scope), binding);
      if (Array.isArray(raw)) return raw;
      if (raw == null) return [];
      // Entity pin / single object → collection-of-one (docs/118 §4): repeats
      // once, scoping descendants to `item.*`.
      return [raw];
    },
  };
}
