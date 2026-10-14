// The note about checking a mailbox shows only when there is one (sparx persona
// issue 236).
//
// With no mailbox connected, the foot of the pane still said "Use the refresh
// button on a row to check one right now." There was no row and no button.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const pane = readFileSync(fileURLToPath(new URL('./mailboxes-list.tsx', import.meta.url)), 'utf8');

describe('the mailbox check note', () => {
  it('is drawn only when a mailbox is listed', () => {
    expect(pane).toContain('<CheckNote listed={rows.length > 0} />');
    expect(pane).toMatch(/return listed \? \(\s*<p[^>]*>[\s\S]{0,400}?'crm\.mailbox\.checkNote'/);
  });
});
