// A record's name shows once: in its own box (CLAUDE.md, "Detail surfaces show
// identity once"). Wasatch Front's account and the "Seals & O-rings" markup rule
// both printed the name as a heading over the box holding it, and while it was
// being edited the two copies disagreed (sparx persona issue 233). A new record
// keeps its "Add a ..." title: that is what the form is for, not a name.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

describe('a record name is not repeated as a heading', () => {
  it('on a trade account', () => {
    expect(read('./b2b/account-detail.tsx')).not.toMatch(
      /<Heading[^>]*>\s*\{account\.companyName\}\s*<\/Heading>/
    );
  });

  it('on a markup rule', () => {
    // The tab title keeps the name; the heading in the pane must not.
    expect(read('./commerce/markup-rule-detail.tsx')).not.toContain(
      "{isNew ? 'Add a markup rule' : (rule?.name ?? 'Markup rule')}"
    );
  });
});
