// The conversation gets the room in its own pane (sparx persona issue 234).
//
// The customer card took all the height it wanted and left the messages one
// line. The card now gives way: capped, scrolling inside itself, while the
// message list keeps a floor, and the column scrolls as a whole rather than cut
// the reply box off.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

describe('a conversation pane', () => {
  it('caps the customer card, which scrolls inside itself', () => {
    expect(read('./thread-context-card.tsx')).toContain('max-h-[30%] shrink-0');
    expect(read('./thread-context-card.tsx')).toContain('overflow-y-auto p-3');
  });

  it('never lets the messages shrink below a floor', () => {
    expect(read('./thread-messages.tsx')).toContain('className="min-h-48 flex-1');
  });

  it('scrolls as a whole rather than cut the reply box off', () => {
    expect(read('./thread.tsx')).toContain(
      '<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">'
    );
  });
});
