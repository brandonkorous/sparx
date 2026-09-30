// The template editor shows a list; the server stores a tree. Everything that
// can be lost between those two shapes is lost HERE.
//
// Two failures this pins down, both silent:
//
//   · a block the editor offers that the print renderer has no case for draws
//     NOTHING. Adding it changes the preview not at all, which reads as a broken
//     button rather than an unsupported block. `BLOCK_KINDS` is checked against
//     the platform's own list of data-aware node types rather than against a
//     copy of it written here, so a type added upstream and not offered fails.
//   · a save rebuilds the tree from the list, so anything the list does not
//     carry is deleted. Round-tripping the built-in default is the guard.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INVOICE_TEMPLATE,
  INVOICE_STRUCTURED_NODE_TYPES,
} from '@wizeworks/crm-schemas/builtins';
import { comparableDraft, emptyTemplateDraft, toTemplateDraft } from './template-data';
import {
  addableKinds,
  blankBlock,
  blocksToTree,
  BLOCK_KINDS,
  describeBlock,
  proseToText,
  textToProse,
  tidyProse,
  treeRoot,
  treeToBlocks,
} from './template-blocks';

const DEFAULT_TREE = DEFAULT_INVOICE_TEMPLATE.tree as unknown;

describe('the blocks a template is made of', () => {
  it('offers every data-aware block the platform declares', () => {
    const offered = new Set(BLOCK_KINDS.map((kind) => kind.type));
    for (const type of INVOICE_STRUCTURED_NODE_TYPES) {
      expect(offered.has(type), `${type} is not offered in the editor`).toBe(true);
    }
  });

  it('names every block in words, never by its type', () => {
    for (const kind of BLOCK_KINDS) {
      expect(kind.label).not.toContain('Invoice');
      expect(kind.label.length).toBeGreaterThan(3);
      expect(kind.blurb.endsWith('.')).toBe(true);
    }
  });

  it('reads the built-in default as its eight blocks, in order', () => {
    const blocks = treeToBlocks(DEFAULT_TREE);
    expect(blocks.map((block) => block.type)).toEqual([
      'InvoiceMasthead',
      'InvoiceParties',
      'InvoiceLineTable',
      'InvoiceTotals',
      'Prose',
      'InvoiceNotes',
      'InvoicePayments',
      'InvoiceFooter',
    ]);
    // Ids come from the stored tree, not minted fresh — a save must not renumber
    // a template someone else is looking at.
    expect(blocks[0]!.id).toBe('tpl-masthead');
  });

  it('gives a block the same key every time the same tree is read', () => {
    // The editor re-adopts the template whenever the server answers, so a key
    // minted fresh each read makes every row a new row to React — and the block
    // somebody had open folds shut the instant they press Save.
    const first = treeToBlocks(DEFAULT_TREE).map((block) => block.key);
    const again = treeToBlocks(DEFAULT_TREE).map((block) => block.key);
    expect(again).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });

  it('still hands out one key per row when a tree repeats an id', () => {
    const blocks = treeToBlocks({
      id: 'r',
      type: 'Section',
      children: [
        { id: 'same', type: 'Divider' },
        { id: 'same', type: 'Divider' },
      ],
    });
    expect(new Set(blocks.map((block) => block.key)).size).toBe(2);
  });

  it('rebuilds the same tree it read', () => {
    const blocks = treeToBlocks(DEFAULT_TREE);
    const rebuilt = blocksToTree(treeRoot(DEFAULT_TREE), blocks);
    expect(rebuilt).toEqual(DEFAULT_TREE);
  });

  it('keeps a nested group whole rather than flattening it away', () => {
    const tree = {
      id: 'tpl-root',
      type: 'Section',
      children: [
        { id: 'a', type: 'InvoiceMasthead' },
        {
          id: 'pair',
          type: 'Row',
          class: 'flex-row',
          children: [
            { id: 'b', type: 'InvoiceParties' },
            { id: 'c', type: 'InvoiceMeta' },
          ],
        },
      ],
    };
    const blocks = treeToBlocks(tree);
    expect(blocks).toHaveLength(2);
    expect(blocksToTree(treeRoot(tree), blocks)).toEqual(tree);
    // And it says what it is rather than showing a type name.
    expect(describeBlock(blocks[1]!).label).toBe('A group of blocks');
  });

  it('treats a template that is a single block as one block, not none', () => {
    const tree = { id: 'only', type: 'InvoiceLineTable' };
    const blocks = treeToBlocks(tree);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe('InvoiceLineTable');
  });

  it('says plainly when a block draws nothing', () => {
    const [block] = treeToBlocks({
      id: 'r',
      type: 'Section',
      children: [{ id: 'x', type: 'Xyz' }],
    });
    expect(describeBlock(block!).blurb).toContain('Nothing is drawn');
  });

  it('carries the terms text out and back', () => {
    const blocks = treeToBlocks(DEFAULT_TREE);
    const prose = blocks.find((block) => block.type === 'Prose')!;
    const text = proseToText(prose.props.doc);
    expect(text).toContain('Payment is due upon receipt');

    const twoLines = 'Net 30 days.\nLate payments carry 1.5% a month.';
    expect(proseToText(textToProse(twoLines))).toBe(twoLines);
  });

  it('lets a space be typed', () => {
    // The textarea is controlled, so every keystroke goes out through
    // textToProse and comes straight back through proseToText to redraw the
    // box. Anything trimmed on that round trip is a character that CANNOT BE
    // TYPED. Trimming here ate the space after every word and swallowed Return
    // entirely: "Payment is due within 14 days." came out of the box as
    // "Paymentisduewithin14days." Measured on screen 2026-09-22.
    expect(proseToText(textToProse('Payment is '))).toBe('Payment is ');
    expect(proseToText(textToProse('One.\n'))).toBe('One.\n');
    expect(proseToText(textToProse('One.\n\nTwo.'))).toBe('One.\n\nTwo.');
  });

  it('drops blank lines on the way to the server, and only there', () => {
    const typed = textToProse('  One.  \n\n\nTwo.\n');
    // Still exactly what is in the box…
    expect(proseToText(typed)).toBe('  One.  \n\n\nTwo.\n');
    // …and tidied once, when it is stored.
    expect(proseToText(tidyProse(typed))).toBe('One.\nTwo.');
  });

  it('tidies authored text when the tree is rebuilt for a save', () => {
    const blocks = treeToBlocks({
      id: 'r',
      type: 'Section',
      children: [{ id: 'p', type: 'Prose', props: { doc: textToProse('Terms. \n\n') } }],
    });
    const saved = blocksToTree({ id: 'r', type: 'Section' }, blocks) as {
      children: { props: { doc: unknown } }[];
    };
    expect(proseToText(saved.children[0]!.props.doc)).toBe('Terms.');
  });

  it('adds blocks that are visible the moment they are added', () => {
    // An empty Prose or Heading prints nothing, so the preview would be
    // identical before and after — which reads as the button not working.
    expect(proseToText(blankBlock('Prose').props.doc).length).toBeGreaterThan(0);
    expect(blankBlock('Heading').props.text).toBeTruthy();
    expect(blankBlock('Text').props.text).toBeTruthy();
  });

  it('stops offering a block a page can only hold once', () => {
    const blocks = treeToBlocks(DEFAULT_TREE);
    const offered = addableKinds(blocks).map((kind) => kind.type);
    expect(offered).not.toContain('InvoiceLineTable');
    expect(offered).not.toContain('InvoiceTotals');
    // Still offered, because the default does not use them.
    expect(offered).toContain('InvoiceLogo');
    // And the repeatable ones never stop being offered.
    expect(offered).toContain('Prose');
    expect(offered).toContain('Divider');
  });
});

describe('what counts as an unsaved change', () => {
  it('ignores the session keys, so a re-read is not an edit', () => {
    // Each call mints its own React keys. If they reached the comparison, every
    // refetch would look like an edit — and the editor's adopt is GUARDED on
    // that, so a pane that starts dirty never adopts at all: opening a saved
    // template showed a blank editor. Measured on screen 2026-09-22.
    const a = emptyTemplateDraft();
    const b = emptyTemplateDraft();
    expect(comparableDraft(a)).toBe(comparableDraft(b));
    expect(comparableDraft(a)).not.toContain('"key"');
  });

  it('matches a template read back from the server with the same content', () => {
    const template = {
      id: 't',
      name: '',
      isDefault: false,
      propertyId: null,
      propertyName: null,
      tree: DEFAULT_TREE,
      published: false,
      publishedAt: null,
      createdAt: '',
      updatedAt: '',
    };
    expect(comparableDraft(toTemplateDraft(template))).toBe(comparableDraft(emptyTemplateDraft()));
  });

  it('still notices a real change', () => {
    const base = emptyTemplateDraft();
    expect(comparableDraft({ ...base, name: 'Ours' })).not.toBe(comparableDraft(base));
    expect(comparableDraft({ ...base, propertyId: 'site-1' })).not.toBe(comparableDraft(base));
    expect(comparableDraft({ ...base, blocks: base.blocks.slice(1) })).not.toBe(
      comparableDraft(base)
    );
  });
});
