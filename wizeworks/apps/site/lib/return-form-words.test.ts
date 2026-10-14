// The return form speaks to any shop (sparx persona issue 190). Brynn sent back a
// fuel injector and was offered "a size up in the same color".

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const page = readFileSync(
  fileURLToPath(
    new URL('../app/account/(authed)/orders/[orderId]/return/page.tsx', import.meta.url)
  ),
  'utf8'
);

describe('the return form', () => {
  it('does not assume clothing', () => {
    expect(page).not.toMatch(/size up|size or color|same color/i);
  });

  it('does not promise the money goes back to a card she may not have used', () => {
    expect(page).not.toContain('We will put the money back the way you paid.');
  });
});
