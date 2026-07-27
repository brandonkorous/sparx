// The silica-native email persistence contract (docs/120 Stage 2) — the wire +
// storage shape for an email authored on silicaui 0.17's `<EmailBuilder>`.
//
// silica hands the host a whole `EmailProject` on `onChange`, but sparx keeps its
// OWN email catalog (one `BuilderEmail` row per email, with per-site override +
// keyed-default semantics the flat silica roster doesn't model), so sparx mounts
// the editor ONE document at a time and persists that single `EmailDocument` per
// row (docs/120 D3). This module is the boundary validator + the stored type.
//
// The document is silica's own shape — OPAQUE to sparx (silica authored +
// validated it; sparx never parses an `EmailNode`). So it validates STRUCTURALLY
// here (subject/preheader strings + a `body` root), exactly as the sparx
// `BuilderNode` trees were only ever validated at the boundary, never in the DB.

import { z } from 'zod';
import type {
  EmailDocument as SilicaEmailDocument,
  EmailNode as SilicaEmailNode,
} from '@wizeworks/silicaui-builder/email';

import { EMAIL_PERSONALIZED_ROOTS } from './binding';
import { parseEmailTokens } from './email-tokens';
import { bindingSourceKey } from './runtime';

// Re-export under a sparx-namespaced alias so consumers (`emailService`, the
// dashboard editor, `@sparx/email`'s silica renderer) get the type without each
// taking its own direct `silicaui-builder/email` dependency edge.
export type { SilicaEmailDocument, SilicaEmailNode };

/** A silica `EmailNode` — the unit a "Save as block" stores. Validated
 *  STRUCTURALLY (silica owns the full node shape, sparx never parses it): an
 *  object carrying a string `kind`. Stored opaquely as JSONB, the same contract as
 *  {@link SilicaEmailDocumentInput}. */
export const SilicaEmailNodeInput = z.custom<SilicaEmailNode>(
  (v) => {
    if (typeof v !== 'object' || v === null) return false;
    return typeof (v as { kind?: unknown }).kind === 'string';
  },
  { message: 'Expected a silica EmailNode (an object with a string `kind`)' }
);

/** A silica `EmailDocument` — `{ version, subject, preheader, root: EmailBody }`.
 *  Validated structurally (silica owns the full node shape): an object carrying
 *  string `subject`/`preheader` and a `root` whose `kind === 'body'`. Stored
 *  opaquely as JSONB and projected to HTML by silica's `toEmailHtml`. `z.custom`
 *  keeps the real `SilicaEmailDocument` type while sparx stores it verbatim. */
export const SilicaEmailDocumentInput = z.custom<SilicaEmailDocument>(
  (v) => {
    if (typeof v !== 'object' || v === null) return false;
    const doc = v as { subject?: unknown; preheader?: unknown; root?: unknown };
    if (typeof doc.subject !== 'string' || typeof doc.preheader !== 'string') return false;
    const root = doc.root as { kind?: unknown } | null | undefined;
    return typeof root === 'object' && root !== null && root.kind === 'body';
  },
  { message: 'Expected a silica EmailDocument (subject + preheader + a `body` root)' }
);

/** The persisted silica email — everything sparx stores for a silica-authored
 *  email: its draft document, and the last published snapshot (null until first
 *  publish, mirroring the sparx `draftTree`/`publishedTree` pair). A `BuilderEmail`
 *  row carries these ALONGSIDE the legacy sparx trees during the parallel-run
 *  migration (docs/120 D1); the presence of `published` is what routes a send
 *  through `renderSilicaEmail` instead of the legacy `renderEmailTree`. */
export interface StoredSilicaEmail {
  draft: SilicaEmailDocument;
  published: SilicaEmailDocument | null;
}

// ── Source collection (which DataSources a silica email references) ───────────
//
// The silica twin of `collectEmailSourceKeys` (email-tokens.ts). The send resolves
// ONLY the sources a document actually references, so a static email costs nothing.
// A silica email references data two ways:
//   · a `data` binding marker (`{ kind: 'value' | 'collection', ref }`) on any node;
//   · a `{{token}}` inside author copy — silica interpolates text + button labels
//     natively, and `renderSilicaEmail` covers the rest (href / src / raw HTML).
// Both must be surfaced or the send would render a bound node against no data.

/** Every string field on a silica email node that may carry `{{tokens}}`. */
function tokenStringsOf(node: SilicaEmailNode): string[] {
  switch (node.kind) {
    case 'text':
      return [node.html];
    case 'html':
      return [node.html];
    case 'button':
      return [node.label, node.href];
    case 'image':
      return [node.src, node.alt, node.href ?? ''];
    case 'video':
      return [node.href, node.thumbnail];
    case 'section':
      return [node.bgImage ?? ''];
    default:
      return [];
  }
}

/** Every data PATH a silica email references — `data.ref` markers plus `{{token}}`
 *  paths in copy. `extra` carries strings outside the tree (subject / preheader).
 *
 *  Refs INSIDE a `collection` scope are scope-relative (silica's picker writes the
 *  field's own key, e.g. `name`, and the engine supplies `scope.item`), so they name
 *  no source of their own — the enclosing collection's ref already loaded it. We drop
 *  them, exactly as `collectEmailPaths` drops `item.*` / `index`. */
export function collectSilicaEmailPaths(doc: SilicaEmailDocument, extra: string[] = []): string[] {
  const out: string[] = [];
  const pushTokens = (s: string): void => {
    if (!s.includes('{{')) return;
    for (const t of parseEmailTokens(s)) out.push(t.path);
  };
  const walk = (node: SilicaEmailNode, inCollection: boolean): void => {
    const data = node.data;
    if (data?.ref) {
      // A bare ref inside a collection scope is item-relative — not a source.
      if (!inCollection) out.push(data.ref);
    }
    for (const s of tokenStringsOf(node)) pushTokens(s);
    const scoped = inCollection || data?.kind === 'collection';
    if ('children' in node) {
      for (const child of node.children as SilicaEmailNode[]) walk(child, scoped);
    }
  };
  walk(doc.root, false);
  for (const s of extra) pushTokens(s);
  return out;
}

/** The distinct SOURCE KEYS a silica email references — exactly the set the send
 *  path must load. The silica twin of `collectEmailSourceKeys`. */
export function collectSilicaEmailSourceKeys(
  doc: SilicaEmailDocument,
  extra: string[] = []
): Set<string> {
  return new Set(collectSilicaEmailPaths(doc, extra).map(bindingSourceKey).filter(Boolean));
}

/** Does this silica email resolve anything PER-RECIPIENT (customer / order / cart /
 *  …)? Drives the broadcast's defer-vs-render-once decision: a personalized email
 *  must be rendered per recipient by the dispatch tick; a static one renders once and
 *  fans out.
 *
 *  Unlike the legacy `treeIsEmailPersonalized` (which inspects node BINDINGS only),
 *  this counts `{{tokens}}` too — in silica a `{{customer.firstName}}` in a text
 *  block IS the personalization, so ignoring tokens would render one shared copy with
 *  every name blank. */
export function silicaEmailIsPersonalized(doc: SilicaEmailDocument, extra: string[] = []): boolean {
  for (const key of collectSilicaEmailSourceKeys(doc, extra)) {
    if (EMAIL_PERSONALIZED_ROOTS.includes(key)) return true;
  }
  return false;
}
