// What an author DID, as semantic operations.
//
// Ops rather than snapshots, for one reason that pays for the whole design: an
// op carries its own inverse the moment it is applied (`applyOp` returns both),
// so undo is exact and per-document without holding a copy of every prior tree.
// It is also the wire shape a relay would need, so live co-editing later is a
// transport question rather than a rewrite.
//
// Each op names ONE change. `node.replace` exists for the genuinely wholesale
// case (stamping a block, applying a template) and is deliberately awkward to
// reach for — an op that can mean anything cannot be described in an undo label.

import type { DataBinding, Theme } from '@wizeworks/silicaui-html';
import type { EmailNode } from '@wizeworks/silicaui-builder/email';
import type { AddressableNode } from '../tree/walk';
import type { FrameChoice, PageSeo } from '../documents/types';

/** Edits to a node tree — layout, page and component documents. */
export type TreeOp =
  | { kind: 'node.insert'; parentId: string; index: number; node: AddressableNode }
  | { kind: 'node.remove'; id: string }
  | { kind: 'node.move'; id: string; parentId: string; index: number }
  | { kind: 'node.replace'; id: string; node: AddressableNode }
  | { kind: 'node.setClass'; id: string; value: string | undefined }
  | { kind: 'node.setText'; id: string; value: string }
  | { kind: 'node.setTag'; id: string; value: string }
  | { kind: 'node.setLabel'; id: string; value: string | undefined }
  | { kind: 'node.setProp'; id: string; key: string; value: unknown }
  | { kind: 'node.setAttr'; id: string; key: string; value: string | number | boolean | undefined }
  | { kind: 'node.setData'; id: string; value: DataBinding | undefined }
  | { kind: 'node.setLocked'; id: string; value: 'host' | 'author' | undefined };

/**
 * Edits to an EMAIL tree.
 *
 * A separate union from `TreeOp` because it is a separate vocabulary, not a
 * dialect of one: an email node has no class, no tag and no attributes, and its
 * children arrays are typed per kind. One `email.patch` covers every visual
 * decision, since each of them is a named field rather than a class string.
 */
export type EmailTreeOp =
  | { kind: 'email.insert'; parentId: string; index: number; node: EmailNode }
  | { kind: 'email.remove'; id: string }
  | { kind: 'email.move'; id: string; parentId: string; index: number }
  | { kind: 'email.replace'; id: string; node: EmailNode }
  | { kind: 'email.patch'; id: string; patch: Readonly<Record<string, unknown>> }
  | { kind: 'email.setData'; id: string; value: DataBinding | undefined };

/** Edits to a document's own fields — never to its tree. */
export type FieldOp =
  | { kind: 'doc.rename'; value: string }
  | { kind: 'page.setSlug'; value: string | null }
  | { kind: 'page.setFrame'; value: FrameChoice }
  | { kind: 'page.setSeo'; value: PageSeo }
  | { kind: 'page.setRecord'; recordType: string | null; recordSubtype: string | null }
  | { kind: 'page.setDefault'; value: boolean }
  | { kind: 'email.setSubject'; value: string }
  | { kind: 'email.setPreheader'; value: string };

/** Edits to a theme document. A token op is per MODE: the light and dark values
 *  of one token are two separate authored decisions, and collapsing them is how
 *  a dark override silently follows a light edit it was written to escape. */
export type ThemeOp =
  | { kind: 'theme.setToken'; mode: 'light' | 'dark'; token: string; value: string | undefined }
  | { kind: 'theme.setName'; value: string }
  | { kind: 'theme.replace'; value: Theme };

export type StudioOp = TreeOp | EmailTreeOp | FieldOp | ThemeOp;

export function isTreeOp(op: StudioOp): op is TreeOp {
  return op.kind.startsWith('node.');
}

export function isThemeOp(op: StudioOp): op is ThemeOp {
  return op.kind.startsWith('theme.');
}

/**
 * Listed rather than prefix-matched, unlike its two siblings above.
 * `email.setSubject` and `email.setPreheader` are FIELD ops that share the
 * prefix, so `startsWith('email.')` would route a subject edit into the tree
 * applier, which would refuse it — a rename that silently stopped working.
 */
const EMAIL_TREE_KINDS = new Set<string>([
  'email.insert',
  'email.remove',
  'email.move',
  'email.replace',
  'email.patch',
  'email.setData',
]);

export function isEmailTreeOp(op: StudioOp): op is EmailTreeOp {
  return EMAIL_TREE_KINDS.has(op.kind);
}

/**
 * A batch of ops applied together, with the inverses that undo it.
 *
 * `inverse` is stored in REVERSE application order, so replaying it start to
 * finish undoes the batch. Storing it forwards works for single-op batches and
 * then quietly corrupts the first multi-op one — an insert-then-move undone in
 * the same order moves a node that no longer exists.
 */
export interface OpBatch {
  /** What to call this in an undo tooltip or a history row. */
  label: string;
  ops: StudioOp[];
  inverse: StudioOp[];
}
