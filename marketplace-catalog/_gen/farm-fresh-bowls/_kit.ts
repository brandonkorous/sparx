// Farm Fresh generator — shared authoring KIT. Every other module composes
// trees through the single `node()` helper exported here, so node ids are minted from
// ONE shared counter. That counter advances in `node()` CALL order, and the ids are
// persisted into the payload + used as React/dnd-kit keys (CLAUDE.md), so call order is
// load-bearing: `manifest.ts` invokes the tree builders in a fixed order to keep ids
// stable across regens. Import `node`/`doc`/`MenuItem` from here, never `seedNode`
// directly — that keeps the counter shared.

import { seedNode, type BuilderNode } from '../../../packages/builder-schemas/src/index';

export type { BuilderNode };

let nid = 0;

/** Mint a node with a globally-stable `ffb-<n>` id (n increments per call). */
export const node = (type: string, opts: Parameters<typeof seedNode>[2] = {}): BuilderNode =>
  seedNode(`ffb-${(nid += 1)}`, type, opts);

/** A ProseMirror rich-text doc from paragraphs (CMS bodies). */
export const doc = (...paragraphs: string[]): Record<string, unknown> => ({
  type: 'doc',
  content: paragraphs.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })),
});

/** A menu-showcase item (home page menu groups). */
export interface MenuItem {
  name: string;
  price: string;
  desc: string;
  tags: string[];
  seed: string;
}
