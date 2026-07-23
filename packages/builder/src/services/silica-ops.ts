// Silica op synthesis for SCRIPTED writers (docs/126 §4.5).
//
// The op protocol (docs/126) was designed for the INTERACTIVE editor: silicaui hands
// the host causal `Op[]` describing what the author DID, node by node. A scripted
// writer — an MCP tool authoring on an agent's behalf — has no such stream; it produces
// a terminal tree, not a sequence of deltas. But for a co-editor to see an agent's work
// fold in LIVE (rather than only on their next reload), the agent's change has to reach
// the relay as ops, exactly like a human edit.
//
// So the MCP wrappers SYNTHESIZE the matching op for the changes that have a faithful,
// non-destructive representation in the engine's vocabulary:
//
//   · create a new page   → `page.create` — applyRemoteOps does `pages.push()`, leaving
//                           every other page (and a co-editor's unsaved edits) untouched.
//   · delete a page       → `page.delete`
//   · set the theme       → `theme.set` (+ `savedThemes.set`)
//
// What DOESN'T get an op — deliberately (see §4.5): REPLACING an existing page's body or
// the frame. `page.create` is insert-only (the reducer drops it when the id already
// exists), and a scripted body is re-stamped with fresh node ids, so there is no stable
// id correspondence to diff into node ops. The only vocabulary item that could carry it
// is `site.replace`, which CLOBBERS the whole document on the receiver — the opposite of
// non-destructive. Those changes surface to a co-editor as a "reload this page" prompt
// (Slice 3), never a forced overwrite of their in-progress work.
//
// These shapes mirror what the engine itself records (silicaui-builder's reducer emits
// `{ target: { scope: 'site' }, kind: 'page.create', page }` etc.), so a synthesized op
// is indistinguishable from a human one when `applyRemoteOps` folds it in. They validate
// as `BuilderOpEnvelope` (target + kind) and are stored/relayed opaquely otherwise.

import { randomUUID } from 'node:crypto';

import type { BuilderOpEnvelope, SilicaNode, SilicaTheme } from '@sparx/builder-schemas';

/** The site-scoped target every page-collection / theme op carries — these are not
 *  tree-node edits, so they address the site, not a page/frame/symbol tree. */
const SITE_TARGET = { scope: 'site' as const };

/** A silica `Page` as an op carries it — the flat engine shape `{ id, name, slug, root }`
 *  (no host domain columns; those are applied out-of-band). */
export interface SilicaOpPage {
  id: string;
  name: string;
  slug: string;
  root: SilicaNode;
}

/** `page.create` — insert a whole new page. Non-destructive on the receiver: the reducer
 *  pushes it onto `pages` and drops it if the id already exists, so it can only ADD. */
export function pageCreateOp(page: SilicaOpPage): BuilderOpEnvelope {
  return { target: SITE_TARGET, kind: 'page.create', page };
}

/** `page.delete` — remove a page by id (the reducer refuses to remove the last one). */
export function pageDeleteOp(pageId: string): BuilderOpEnvelope {
  return { target: SITE_TARGET, kind: 'page.delete', pageId };
}

/** `theme.set` — replace the site-global theme wholesale. */
export function themeSetOp(theme: SilicaTheme): BuilderOpEnvelope {
  return { target: SITE_TARGET, kind: 'theme.set', theme };
}

/** `savedThemes.set` — replace the saved-theme library wholesale (`[]` clears it). */
export function savedThemesSetOp(savedThemes: SilicaTheme[]): BuilderOpEnvelope {
  return { target: SITE_TARGET, kind: 'savedThemes.set', savedThemes };
}

/** A fresh, unique id for one scripted flush's op batch — the same idempotency key the
 *  interactive client mints per debounce, so a retried MCP write never double-appends. */
export function newOpBatch(): string {
  return `mcp-${randomUUID()}`;
}
