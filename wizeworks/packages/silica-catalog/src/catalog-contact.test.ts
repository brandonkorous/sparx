// The guard for a contact detail a visitor can ACT on.
//
// `starter-contact.test.ts` covers what installs without the owner choosing it.
// This covers the rest of the palette, and it is deliberately narrower: a block
// may PRINT a sample number, because `_contact-fields.ts` binds the sample and
// the business's own value replaces it. What it may never carry is a literal
// `tel:`/`mailto:` in an ATTRIBUTE — an attribute is not a sample, it is where
// the tap goes, and a bound one is not written into the tree at all.
//
// Issue 265 fixed two blocks and guarded only the starter. Two more survived,
// one of them in a file that fix had edited: the booking prompt's "Call instead"
// and the map block's "Call us" both dialled (555) 123-4567 (issue 268).

import { describe, expect, it } from 'vitest';

import type { Node } from '@wizeworks/silicaui-html';

import { SPARX_CATALOG } from './catalog';
import { boundAttrs } from './attr-binding';

/**
 * Blocks whose sample ROWS are the point.
 *
 * A stockist list and a branch list are tables an author replaces wholesale, and
 * the invented shop names beside the numbers announce them as samples — issue 265
 * drew that line and it still holds. They are named here, one by one, so the
 * exemption is a decision somebody made rather than a hole in the pattern.
 */
const SAMPLE_ROW_BLOCKS = new Set(['stockists', 'location_cards']);

/** What a visitor could tap. */
const ACTIONABLE = /^(mailto|tel):/i;

/** Every attribute value in the tree that a binding does NOT fill at render time. */
function literalAttrs(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as { attrs?: Record<string, unknown>; children?: unknown[] };
  const bound = new Set(boundAttrs(node as Node));
  for (const [name, value] of Object.entries(n.attrs ?? {})) {
    if (typeof value === 'string' && !bound.has(name)) out.push(value);
  }
  for (const c of n.children ?? []) literalAttrs(c, out);
  return out;
}

describe('no palette block links a visitor to someone else’s phone or inbox', () => {
  const items = SPARX_CATALOG.flatMap((group) => group.items);

  it('covers the whole palette, not one group of it', () => {
    // The denominator, printed: a scan that silently walked three blocks would
    // pass exactly as loudly as one that walked all of them.
    expect(items.length).toBeGreaterThan(60);
  });

  for (const item of items) {
    if (SAMPLE_ROW_BLOCKS.has(item.key)) continue;
    it(`"${item.label}" carries no tel: or mailto: of its own`, () => {
      const bad = literalAttrs(item.make()).filter((value) => ACTIONABLE.test(value));
      expect(
        bad,
        `block "${item.key}" links to ${bad.join(', ')} — use boundContactAction ` +
          `so the destination is the business's, or the button is not there`
      ).toEqual([]);
    });
  }
});
