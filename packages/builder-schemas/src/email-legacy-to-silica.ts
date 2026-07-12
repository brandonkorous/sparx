// Legacy sparx email tree → silica `EmailDocument` (docs/120 slice 7).
//
// This is the one-way door that lets `renderEmailTree` be deleted. Every existing
// `BuilderEmail` row was authored on the sparx engine and stores a `BuilderNode`
// tree; the silica editor and the silica send path speak `EmailDocument`. Rather
// than reset those rows to their code-shipped defaults — which would silently throw
// away anyone's edits, and has no answer at all for a CUSTOM-key email (there IS no
// default to fall back to) — we convert each row from ITS OWN tree.
//
// It is deliberately TOTAL over the ten node types any stored tree can actually
// contain (verified against the live table): Section · Heading · Text · Prose ·
// Button · Divider · Image/ImageDisplay · conditional_block · line_item_table ·
// email_wordmark · unsubscribe_link · physical_address. Anything unknown is dropped
// rather than guessed at — a missing block is visible and fixable; a wrong one isn't.
//
// THREE node types convert to NOTHING, on purpose. `email_wordmark`,
// `unsubscribe_link`, and `physical_address` were in-body nodes on the sparx engine;
// on silica the send COMPOSES them — the branded frame supplies the wordmark, and the
// marketing footer supplies the unsubscribe + postal address (and only for marketing
// sends, which is where the compliance gate belongs). Carrying them into the body
// would double them.
//
// This module is scheduled for deletion: once the repair pass in
// `provisionDefaultEmails` has run everywhere, no row reads a legacy tree, and the
// `draft_tree` / `published_tree` columns and this file go together.

import type {
  ContentNode,
  EmailDocument,
  ImageNode,
  LayoutChild,
  SectionNode,
  TextNode,
} from '@wizeworks/silicaui-builder/email';

import type { BuilderNode } from './node';
import {
  button,
  divider,
  emailDoc,
  heading,
  itemsTable,
  para,
  section,
  text,
  when,
} from './silica-email-kit';

/** A leaf's data path, when it was bound to one. Only the FIELD binding (`path`) and
 *  the COLLECTION binding carry a ref a silica email can use; entity pins and actions
 *  have no email equivalent and resolve to nothing. */
function fieldRef(node: BuilderNode): string | undefined {
  const path = node.binding?.path;
  return typeof path === 'string' && path.length > 0 ? path : undefined;
}

const str = (node: BuilderNode, key: string): string => {
  const v = node.props?.[key];
  return typeof v === 'string' ? v : '';
};

/** The legacy `Prose` node stored a TipTap/CMS document. builder-schemas can't reach
 *  the HTML serializer (it lives behind a React-free entrypoint in another package,
 *  and pulling it in here would invert the dependency), so we lift the document's
 *  text runs into paragraphs. Prose appears in ZERO stored rows — it was authorable
 *  only through the editor that's now deleted — so this is a completeness guard, not
 *  a load-bearing path; it preserves the words rather than the rich markup. */
function proseParagraphs(doc: unknown): TextNode[] {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === 'text' && typeof node.text === 'string') out.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  const joined = out.join(' ').trim();
  return joined ? [para(joined)] : [];
}

/** One legacy LEAF → the silica content nodes it becomes (0, 1, or many). */
function leafToContent(node: BuilderNode): ContentNode[] {
  const ref = fieldRef(node);
  switch (node.type) {
    case 'Heading': {
      // The sparx engine had two heading levels; silica text carries its own size, so
      // an h2 is the same node one step down the scale rather than a different kind.
      const copy = str(node, 'text');
      const h1 = (str(node, 'level') || 'h2') === 'h1';
      const node2 = h1 ? heading(copy) : text(copy, { size: 22, weight: 'bold' });
      return [ref ? { ...node2, data: { kind: 'value', ref } } : node2];
    }
    case 'Text': {
      const copy = str(node, 'text');
      // `body` was a paragraph; `eyebrow` / `meta` were the muted, smaller chrome.
      const body = (str(node, 'variant') || 'body') === 'body';
      const node2 = body ? para(copy) : text(copy, { size: 14 });
      return [ref ? { ...node2, data: { kind: 'value', ref } } : node2];
    }
    case 'Prose':
      return proseParagraphs(node.props?.doc);
    case 'Button': {
      const node2 = button(str(node, 'label') || 'Button', str(node, 'href') || '#');
      return [ref ? { ...node2, data: { kind: 'value', ref } } : node2];
    }
    case 'Divider':
      return [divider()];
    case 'Image':
    case 'ImageDisplay': {
      const src = str(node, 'src');
      // A bound image (`ImageDisplay`) has no src until it resolves, so it converts on
      // the strength of its binding; a static image with neither src nor ref is empty
      // and converts to nothing.
      if (!src && !ref) return [];
      const img: ImageNode = {
        id: `def-s-image-${node.id}`,
        kind: 'image',
        src,
        alt: str(node, 'alt'),
        width: 560,
        align: 'center',
        ...(ref ? { data: { kind: 'value' as const, ref, attr: 'src' } } : {}),
      };
      return [img];
    }
    // Composed by the SEND on silica, never carried in the body — see the file header.
    case 'email_wordmark':
    case 'unsubscribe_link':
    case 'physical_address':
      return [];
    default:
      return [];
  }
}

/** A legacy node that becomes its OWN top-level section (silica forbids a section
 *  inside a section, so a conditional or a repeat can't be an inline wrapper). */
function isBlockLevel(node: BuilderNode): boolean {
  return node.type === 'conditional_block' || node.type === 'line_item_table';
}

/**
 * Flatten the legacy tree into an ordered stream of "runs": each run is either a
 * sequence of inline leaves (which will be packed into one section) or a block-level
 * node (which becomes its own section). Legacy `Section` containers are transparent —
 * they were a flex-column wrapper, and silica's section IS that wrapper, so nesting
 * them would just add padding.
 */
function* runs(nodes: BuilderNode[]): Generator<BuilderNode> {
  for (const node of nodes) {
    if (node.type === 'Section') {
      yield* runs(node.children ?? []);
    } else {
      yield node;
    }
  }
}

/** The legacy tree's body → silica sections. */
export function emailTreeToSilicaBody(tree: BuilderNode): SectionNode[] {
  const body: SectionNode[] = [];
  let pending: LayoutChild[] = [];

  const flush = (): void => {
    if (pending.length === 0) return;
    body.push(section(pending));
    pending = [];
  };

  for (const node of runs([tree])) {
    if (isBlockLevel(node)) {
      // A block-level node interrupts the current run: everything authored above it
      // closes into its own section first, so the reading order is preserved.
      flush();
      if (node.type === 'conditional_block') {
        const gate = str(node, 'when');
        const kids = [...runs(node.children ?? [])].flatMap(leafToContent);
        // A conditional with no gate was an unconditional group; one with no surviving
        // children is an empty wrapper. Neither earns a section.
        if (kids.length === 0) continue;
        body.push(gate ? when(gate, kids) : section(kids));
      } else {
        // `line_item_table` bound its collection through the node binding; every stored
        // one is an `<entity>.items` path. It expands to TWO sections (header + rows).
        body.push(...itemsTable(fieldRef(node) ?? 'order.items'));
      }
      continue;
    }
    pending.push(...leafToContent(node));
  }
  flush();
  return body;
}

/**
 * A stored legacy email → the silica `EmailDocument` it becomes. Subject and preheader
 * live on the ROW (not in the tree) on both engines, so they're passed in.
 *
 * Total by construction: an email whose every node dropped (a body that was nothing but
 * a wordmark and a compliance footer) still yields a valid document — an empty body,
 * which the send composes its frame around. It never throws and never returns null,
 * because a send has nowhere to go if it does.
 */
export function emailTreeToSilica(
  tree: BuilderNode,
  subject: string,
  preheader: string | null
): EmailDocument {
  return emailDoc(subject, preheader ?? '', emailTreeToSilicaBody(tree));
}
