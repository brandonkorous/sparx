// What a print template is MADE OF, in the owner's words.
//
// The stored template is a BuilderNode tree — the same shape the page and email
// builders store — and the print renderer walks it looking for a tier of
// data-aware node types (`InvoiceLineTable`, `InvoiceTotals`, …) which it swaps
// for the real financial blocks, surrounded by chrome the author writes.
//
// The editor does NOT show a tree. It shows the root section's children as an
// ordered list of named blocks, because that is what the default template is and
// what anyone designing a bill actually wants to change: what appears, in what
// order. Nesting is rare, authored by MCP or a future layout tool, and is shown
// as one block that can be moved and removed but not opened — an editor that
// silently flattened it would delete somebody's work on save.
//
// A node's `type` is never shown. "InvoiceLineTable" is a fact about our code;
// "What they are paying for" is the same fact in the language of the person
// choosing whether to keep it. [[feedback_non_technical_audience]]

/** One block the editor holds, before it is anything the server stores. */
export interface TemplateBlock {
  /**
   * Session-local React key. Random, never sent: a block that has just been
   * added has no stable identity yet, and using the array index instead makes
   * React reuse the wrong row's state the moment two blocks swap places.
   */
  key: string;
  /** The node's own id. Preserved across a save so ids stay stable. */
  id: string;
  type: string;
  name?: string;
  class?: string;
  props: Record<string, unknown>;
  /** Children, for a block the editor shows but does not open. Kept verbatim so
   *  a save never quietly discards a nested layout it could not draw. */
  children?: unknown[];
}

export interface BlockKind {
  type: string;
  /** What this block is called on screen. */
  label: string;
  /** What it puts on the page, in the owner's words. */
  blurb: string;
  /** Whether a template can hold more than one. A second "What they are paying
   *  for" is the same table twice; a second heading is ordinary. */
  repeatable: boolean;
  /**
   * Does it draw the invoice's own facts, or words you write here?
   *
   * The distinction is the one that matters when choosing: the first group is
   * filled in for you and changes per invoice, the second is the same on every
   * invoice until you change it.
   */
  fromTheInvoice: boolean;
}

/**
 * Every block the print renderer understands.
 *
 * Kept in the order they appear on a finished bill, because the list doubles as
 * the "add a block" menu and reading it top to bottom should describe a page.
 * A type the renderer does not recognise draws nothing at all, so this list is
 * exactly `renderLeaf`'s switch in api-rest's invoice-tree-render.ts — a block
 * offered here that it has no case for is a block that silently disappears.
 */
export const BLOCK_KINDS: readonly BlockKind[] = [
  {
    type: 'InvoiceMasthead',
    label: 'The top of the page',
    blurb:
      'Your business name and address on one side, and the invoice number, whether it is paid, and the dates on the other.',
    repeatable: false,
    fromTheInvoice: true,
  },
  {
    type: 'InvoiceLogo',
    label: 'Your name and address only',
    blurb: 'Your side of the top of the page on its own, for laying the two halves out yourself.',
    repeatable: false,
    fromTheInvoice: true,
  },
  {
    type: 'InvoiceMeta',
    label: 'The invoice details only',
    blurb: 'The number, whether it is paid, and the dates, on their own.',
    repeatable: false,
    fromTheInvoice: true,
  },
  {
    type: 'InvoiceParties',
    label: 'Who it is for',
    blurb: 'The customer you are billing, and where it is being delivered when that is different.',
    repeatable: false,
    fromTheInvoice: true,
  },
  {
    type: 'InvoiceLineTable',
    label: 'What they are paying for',
    blurb: 'Every line on the invoice, with how many, the price each, and the amount.',
    repeatable: false,
    fromTheInvoice: true,
  },
  {
    type: 'InvoiceTotals',
    label: 'The amounts',
    blurb: 'Subtotal, tax, delivery, the total, and what is still owed.',
    repeatable: false,
    fromTheInvoice: true,
  },
  {
    type: 'InvoicePayments',
    label: 'Payments received',
    blurb: 'Each payment made against this invoice, with the date it arrived.',
    repeatable: false,
    fromTheInvoice: true,
  },
  {
    type: 'InvoiceNotes',
    label: 'The note on this invoice',
    blurb: 'Whatever you typed in the Notes box on the invoice itself. Different every time.',
    repeatable: false,
    fromTheInvoice: true,
  },
  {
    type: 'InvoiceFooter',
    label: 'The line at the very bottom',
    blurb: 'Your business name and the invoice number, small, under everything else.',
    repeatable: false,
    fromTheInvoice: true,
  },
  {
    type: 'Prose',
    label: 'Your own words',
    blurb:
      'A paragraph you write once that every invoice carries. Your payment terms, or a thank you.',
    repeatable: true,
    fromTheInvoice: false,
  },
  {
    type: 'Heading',
    label: 'A heading',
    blurb: 'A line of larger text, to label what comes after it.',
    repeatable: true,
    fromTheInvoice: false,
  },
  {
    type: 'Text',
    label: 'A line of text',
    blurb: 'One short line, the same on every invoice.',
    repeatable: true,
    fromTheInvoice: false,
  },
  {
    type: 'Image',
    label: 'A picture',
    blurb: 'A logo or a signature, from a web address.',
    repeatable: true,
    fromTheInvoice: false,
  },
  {
    type: 'Divider',
    label: 'A line across the page',
    blurb: 'A thin rule, to separate one part from the next.',
    repeatable: true,
    fromTheInvoice: false,
  },
];

const BY_TYPE = new Map(BLOCK_KINDS.map((kind) => [kind.type, kind]));

/** The layout containers the renderer arranges children inside. Matched to
 *  `CONTAINERS` in invoice-tree-render.ts. */
const CONTAINERS = new Set(['Section', 'Stack', 'Row', 'Grid', 'Card', 'Group', 'Container']);

/**
 * What to call a block on screen.
 *
 * A block the renderer has no case for prints NOTHING, so saying so is the whole
 * point: an author who sees "Draws nothing on the page" can delete it, where a
 * bare type name leaves them guessing why the preview is short.
 */
export function describeBlock(block: TemplateBlock): BlockKind {
  const known = BY_TYPE.get(block.type);
  if (known) return known;
  if (CONTAINERS.has(block.type)) {
    return {
      type: block.type,
      label: block.name ?? 'A group of blocks',
      blurb:
        'Several blocks laid out together. You can move it or take it out here; changing what is inside it is not something this screen does yet.',
      repeatable: true,
      fromTheInvoice: false,
    };
  }
  return {
    type: block.type,
    label: block.name ?? 'Something this screen does not know',
    blurb: 'Nothing is drawn on the page for this. It is safe to take out.',
    repeatable: true,
    fromTheInvoice: false,
  };
}

/**
 * A block's React key, DERIVED from the node's own id rather than minted fresh.
 *
 * It has to survive a re-read of the same tree. The editor re-adopts the
 * template every time the server answers — after a save, after a refetch — and
 * with random keys every row is a new row to React, so the block somebody had
 * open folded shut the moment they pressed Save. Node ids are already unique
 * within a tree and already stable across a save, which is exactly what a key
 * is for; `treeToBlocks` guarantees the uniqueness a malformed tree might not.
 */
export function blockKeyFor(nodeId: string): string {
  return `block-${nodeId}`;
}

/** A node id that is unique inside this tree. Short, because the stored schema
 *  caps it at 64 characters. */
function newNodeId(): string {
  return `tpl-${crypto.randomUUID().slice(0, 8)}`;
}

/* ── Prose ────────────────────────────────────────────────────────────────── */

/**
 * The words out of a rich-text document, one line per paragraph.
 *
 * The stored shape is the editor document the CMS uses, and this screen offers
 * plain paragraphs rather than a rich-text editor — terms and a thank-you are
 * paragraphs. Anything richer that arrived from elsewhere still READS correctly
 * here; it is only re-saving it that flattens the formatting, which is why the
 * field says so.
 */
export function proseToText(doc: unknown): string {
  const walk = (node: unknown): string => {
    if (!node || typeof node !== 'object') return '';
    const record = node as { type?: unknown; text?: unknown; content?: unknown };
    if (typeof record.text === 'string') return record.text;
    if (!Array.isArray(record.content)) return '';
    const joiner = record.type === 'doc' ? '\n' : '';
    return record.content.map(walk).join(joiner);
  };
  return walk(doc);
}

/**
 * Plain paragraphs back into the stored document shape, VERBATIM.
 *
 * Not a single character is trimmed or dropped here, and that is the whole
 * point. The textarea is a controlled field: every keystroke runs the text
 * through this and back through `proseToText` to redraw the box. A tidy-up in
 * this direction is therefore applied to text somebody is still in the middle of
 * typing — and trimming made it IMPOSSIBLE TO TYPE A SPACE, because the space
 * after "Payment" was removed before the "i" of "is" arrived. Measured on
 * screen 2026-09-22: "Payment is due within 14 days." came out
 * "Paymentisduewithin14days." and pressing Return did nothing at all.
 * [[feedback_the_empty_control_is_the_untested_one]]
 *
 * The tidying is real and still happens — once, on the way to the server. See
 * `tidyProse`.
 */
export function textToProse(text: string): Record<string, unknown> {
  const paragraphs = text
    .split(/\r?\n/)
    .map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] }));
  return { type: 'doc', content: paragraphs };
}

/**
 * What gets STORED: the same document with the blank paragraphs gone and each
 * line trimmed.
 *
 * An empty paragraph is invisible on the printed page but still takes up height,
 * so a stray Return would become a gap with no visible cause. Applied at save
 * only, where the person has finished the sentence.
 */
export function tidyProse(doc: unknown): Record<string, unknown> {
  const lines = proseToText(doc)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] }));
  return { type: 'doc', content: lines };
}

/* ── Tree ⇄ blocks ────────────────────────────────────────────────────────── */

interface TreeNode {
  id?: unknown;
  type?: unknown;
  name?: unknown;
  class?: unknown;
  props?: unknown;
  children?: unknown;
}

function toBlock(node: unknown, id: string): TemplateBlock {
  const record = (node ?? {}) as TreeNode;
  return {
    key: blockKeyFor(id),
    id,
    type: typeof record.type === 'string' ? record.type : 'Text',
    ...(typeof record.name === 'string' ? { name: record.name } : {}),
    ...(typeof record.class === 'string' ? { class: record.class } : {}),
    props: record.props && typeof record.props === 'object' ? { ...record.props } : {},
    ...(Array.isArray(record.children) ? { children: record.children } : {}),
  };
}

/**
 * The stored tree as the editor's flat list of blocks.
 *
 * A tree whose root is NOT a container is one block, not zero: a template that
 * is a single line table is a real thing to author, and returning an empty list
 * for it would show "no blocks yet" over a template that prints.
 */
export function treeToBlocks(tree: unknown): TemplateBlock[] {
  const root = (tree ?? {}) as TreeNode;
  const type = typeof root.type === 'string' ? root.type : '';
  // Ids are minted here rather than inside `toBlock` so a tree that repeats one
  // — hand-authored, or copied from another template — still comes out with a
  // unique key per row. Duplicate React keys make dnd-kit quietly stop
  // reordering, which is the failure mode builder node ids were given a random
  // base to avoid in the first place.
  const seen = new Set<string>();
  const idFor = (node: unknown): string => {
    const raw = (node ?? {}) as TreeNode;
    const given = typeof raw.id === 'string' && raw.id ? raw.id : newNodeId();
    const id = seen.has(given) ? newNodeId() : given;
    seen.add(id);
    return id;
  };
  if (!CONTAINERS.has(type)) return [toBlock(root, idFor(root))];
  const children = Array.isArray(root.children) ? root.children : [];
  return children.map((child) => toBlock(child, idFor(child)));
}

/** The root section's own id and class, so rebuilding the tree keeps them rather
 *  than minting a new root every save. */
export function treeRoot(tree: unknown): {
  id: string;
  type: string;
  name?: string;
  class?: string;
} {
  const root = (tree ?? {}) as TreeNode;
  const type = typeof root.type === 'string' ? root.type : '';
  if (!CONTAINERS.has(type)) {
    return { id: 'tpl-root', type: 'Section', name: 'Document', class: 'stack gap-lg' };
  }
  return {
    id: typeof root.id === 'string' && root.id ? root.id : 'tpl-root',
    type,
    ...(typeof root.name === 'string' ? { name: root.name } : {}),
    ...(typeof root.class === 'string' ? { class: root.class } : {}),
  };
}

/** Anything a block should be cleaned up about ON THE WAY OUT, and nowhere
 *  earlier. Today that is the one thing: blank paragraphs in authored text. */
function tidyProps(block: TemplateBlock): Record<string, unknown> {
  if (block.type !== 'Prose' || !('doc' in block.props)) return block.props;
  return { ...block.props, doc: tidyProse(block.props.doc) };
}

/** The blocks back into a tree the server will accept. Every key the stored
 *  schema does not declare is dropped here rather than sent and rejected. */
export function blocksToTree(
  root: { id: string; type: string; name?: string; class?: string },
  blocks: readonly TemplateBlock[]
): Record<string, unknown> {
  return {
    ...root,
    children: blocks.map((block) => ({
      id: block.id,
      type: block.type,
      ...(block.name ? { name: block.name } : {}),
      ...(block.class ? { class: block.class } : {}),
      ...(Object.keys(block.props).length > 0 ? { props: tidyProps(block) } : {}),
      ...(block.children ? { children: block.children } : {}),
    })),
  };
}

/**
 * A block of a given kind, ready to add.
 *
 * Every one arrives with something to see. A Prose or Heading that starts empty
 * draws nothing, so adding it looks like the button did not work — the preview
 * is identical before and after. Starter words are visible, obviously
 * placeholder, and the first thing anyone changes.
 */
export function blankBlock(type: string): TemplateBlock {
  const id = newNodeId();
  const base: TemplateBlock = { key: blockKeyFor(id), id, type, props: {} };
  switch (type) {
    case 'Prose':
      return {
        ...base,
        class: 'notes',
        props: { doc: textToProse('Payment is due on receipt. Thank you for your business.') },
      };
    case 'Heading':
      return { ...base, props: { level: 'h2', text: 'A heading' } };
    case 'Text':
      return { ...base, props: { text: 'A line of text' } };
    case 'Image':
      return { ...base, props: { src: '', alt: '' } };
    default:
      return base;
  }
}

/** Which kinds can still be added: everything repeatable, plus any one-per-page
 *  block not already on it. Offering a second "The amounts" would add a block
 *  that prints the same table twice. */
export function addableKinds(blocks: readonly TemplateBlock[]): BlockKind[] {
  const used = new Set(blocks.map((block) => block.type));
  return BLOCK_KINDS.filter((kind) => kind.repeatable || !used.has(kind.type));
}
