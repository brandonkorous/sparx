// The binding ⇄ opaque-ref codec (docs/118 §4, the sparx↔silica seam).
//
// silica's engine treats a node's `data.ref` as an OPAQUE STRING — it never
// parses it (silicaui-html `resolveTree`). sparx's binding, by contrast, is a
// STRUCTURED descriptor (`{path}` | `{entity,id}` | `{source}` | `{action}`).
// This module is the single place that encodes sparx's structured `NodeBinding`
// into the opaque ref a silica node carries, and decodes it back inside the host
// resolver. The engine stays domain-blind; sparx owns the format on both sides.
//
// Pure + dependency-light (only the `NodeBinding` type from runtime) so it is
// shared by the catalog re-author (encode, at authoring time) and the host
// resolver (decode, at render time) — they cannot drift.

import type { NodeBinding } from './runtime';

/** silica's `data.kind` for a sparx binding. An entity pin resolves to a single
 *  record, which silica's 2-kind model expresses as a **collection-of-one**
 *  (`resolveCollection → [record]`, repeated once, item-scoping descendants) —
 *  see docs/118 §4 and silicaui-html `resolveTree`. */
export function dataKindFor(binding: NodeBinding): 'value' | 'collection' | 'action' {
  if (binding.action) return 'action';
  if (binding.source) return 'collection';
  if (binding.entity && binding.id) return 'collection';
  return 'value';
}

/** Encode a structured binding into the opaque ref a silica node stores. The
 *  common case — a bare field path (`item.title`, `commerce.product.price`) —
 *  encodes as the readable path itself; anything structured (entity/source/
 *  action, or a path carrying extra fields) round-trips as JSON so no field is
 *  lost. `decodeBindingRef` distinguishes the two by the leading `{`. */
export function encodeBindingRef(binding: NodeBinding): string {
  if (binding.path && !binding.entity && !binding.source && !binding.action) {
    return binding.path;
  }
  return JSON.stringify(binding);
}

/** Decode an opaque ref back into a sparx binding. A JSON object (`{…}`) is
 *  parsed structurally; anything else is treated as a bare field path — which
 *  also makes a hand-authored `data.ref` of `"item.title"` Just Work. */
export function decodeBindingRef(ref: string): NodeBinding {
  const trimmed = ref.trim();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as NodeBinding;
    } catch {
      // Not valid JSON — fall through to the bare-path reading.
    }
  }
  return { path: ref };
}
