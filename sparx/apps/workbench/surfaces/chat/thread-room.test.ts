// The conversation gets the room in its own pane (sparx persona issue 234).
//
// Renée's conversation showed her card, her last three orders, the assignment
// picker and the reply box, and the messages got a strip one line high between
// them. The card now gives way: capped, scrolling inside itself, while the
// message list keeps a floor it never shrinks below.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const pane = readFileSync(fileURLToPath(new URL('./thread.tsx', import.meta.url)), 'utf8');

describe('a conversation pane', () => {
  it('caps the customer card, which scrolls inside itself', () => {
    expect(pane).toContain(
      '<section className="card bg-base-100 flex max-h-[30%] shrink-0 flex-col gap-2 overflow-y-auto p-3">'
    );
  });

  it('scrolls as a whole rather than cut the reply box off', () => {
    // `[&>*]:shrink-0`: the card and the reply box keep their own height, so the
    // column scrolls instead of squashing them (check:scroll-squash).
    expect(pane).toContain(
      '<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto [&>*]:shrink-0">'
    );
  });

  it('never lets the messages shrink below a floor', () => {
    expect(pane).toContain(
      '<ol ref={scrollRef} className="min-h-48 flex-1 space-y-3 overflow-y-auto p-1">'
    );
  });
});
