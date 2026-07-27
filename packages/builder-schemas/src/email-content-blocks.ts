// Curated Insert-palette content blocks for the Email Builder — the "content
// blocks / saved rows" a best-in-class email builder offers ON TOP of the bare
// primitives. Each entry is a single, pre-composed, pre-spaced section in the base
// design language (`silica-email-kit`): a summary card, a call to action, a tinted
// callout. An author drops a polished, on-brand section in ONE move instead of
// hand-assembling section → border → radius → rows → spacers.
//
// Fed to the builder via the host seam:
//   host.catalog = () => ({ extend: EMAIL_CONTENT_BLOCKS })
// which MERGES these into (never replaces) silica's built-in 8-block catalog.
//
// Two silica guarantees make this safe and on-brand with no extra work:
//   · `EmailEditor.insert` re-stamps EVERY node id in the inserted subtree
//     (`stampIds` recurses), so the kit's authored `def-` ids never collide, even
//     when the same block is dropped twice.
//   · every colour here is a silica neutral default paired with its `*Auto` flag,
//     so the editor's `setColorDefaults` (and the send's brand pass) repaint each
//     one from the tenant's own theme — a dropped block lands in the tenant's brand.
//
// The copy is PLACEHOLDER, written to be overwritten — a starting layout, not filler
// that reads as real content. Blocks carry no data binding; an author personalizes
// via the binding picker or by typing `{{tokens}}` (the completed merge-tag catalog).

import type { EmailNode, EmailPaletteItem } from '@wizeworks/silicaui-builder/email';
import {
  actionLink,
  button,
  calloutCard,
  copyBlock,
  detailPanel,
  heading,
  para,
} from './silica-email-kit';

/** A palette entry is a key + presentation + a `make()` that returns a FRESH node
 *  subtree each call (silica stamps ids on insert). Keys are `sx-` prefixed so they
 *  never clash with silica's built-in catalog keys. */
function block(
  key: string,
  label: string,
  hint: string,
  icon: EmailPaletteItem['icon'],
  make: () => EmailNode
): EmailPaletteItem {
  return { key: `sx-${key}`, label, hint, icon, make };
}

export const EMAIL_CONTENT_BLOCKS: EmailPaletteItem[] = [
  block('text-block', 'Text block', 'A heading, a line of copy, and a button', 'stack', () =>
    copyBlock([
      heading('Add a heading'),
      para('Write a line or two that gets to the point — what this is, and what to do next.'),
      button('Take action', '#'),
    ])
  ),
  block(
    'summary-card',
    'Summary card',
    'A bordered card with a status and key details',
    'box',
    () =>
      detailPanel(
        [
          { label: 'The main thing', value: 'The one detail that matters most', emphasize: true },
          { label: 'A detail', value: 'A supporting line' },
          { label: 'Another detail', value: 'One more, if useful' },
        ],
        { status: { label: '✓ All set', role: 'success' } }
      )
  ),
  block('cta', 'Call to action', 'A primary button with a quiet secondary link', 'button', () =>
    copyBlock([button('Get started', '#', 'center'), actionLink('Or see how it works', '#')])
  ),
  block('callout', 'Callout', 'A tinted card that draws the eye to one message', 'label', () =>
    calloutCard([
      heading('Something worth noticing'),
      para('Use this to highlight a promotion, a heads-up, or the single next step.'),
      button('Learn more', '#'),
    ])
  ),
];
