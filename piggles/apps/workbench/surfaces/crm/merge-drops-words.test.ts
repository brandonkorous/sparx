// A hand merge says which email and phone survive.
//
// MEASURED 2026-10-06 on Gillett: two Brynn O'Hara-Løvdals, one from the Shopify
// import (Lehi) and one typed in after she moved (Kanab), with different emails
// and phones. No duplicate rule pairs them, and the merge keeps only the kept
// record's email and phone (sparx persona issue 109).

import { describe, expect, it } from 'vitest';

import { mergeConfirmWords, mergeDropsWords } from './duplicates-data';

describe('mergeDropsWords', () => {
  it('names the email and phone that are not kept', () => {
    expect(
      mergeDropsWords(
        { email: 'brynn.ohara@kanabmail.test', phone: '+1 (435) 555-0187' },
        { email: 'brynn.ohara@zionsmail.test', phone: '+18015550142' }
      )
    ).toEqual([
      'Emails go to brynn.ohara@kanabmail.test. brynn.ohara@zionsmail.test is not kept.',
      'The phone number is +1 (435) 555-0187. +18015550142 is not kept.',
    ]);
  });

  it('says nothing when the details agree or the kept record has none', () => {
    expect(
      mergeDropsWords(
        { email: 'Brynn.OHara@zionsmail.test', phone: '(801) 555-0142' },
        { email: 'brynn.ohara@zionsmail.test', phone: '+18015550142' }
      )
    ).toEqual([]);
    expect(
      mergeDropsWords(
        { email: null, phone: null },
        { email: 'brynn.ohara@zionsmail.test', phone: '+18015550142' }
      )
    ).toEqual([]);
  });
});

describe('mergeConfirmWords', () => {
  it('names each side by its email when the two names match', () => {
    const words = mergeConfirmWords(
      { name: "Brynn O'Hara-Løvdal", email: 'brynn.ohara@kanabmail.test', phone: null },
      { name: "Brynn O'Hara-Løvdal", email: 'brynn.ohara@zionsmail.test', phone: null }
    );
    expect(words.title).toBe("Merge the two records for Brynn O'Hara-Løvdal?");
    expect(words.description).toBe(
      'Their orders, invoices, spending, notes and addresses move onto the one with brynn.ohara@kanabmail.test. The one with brynn.ohara@zionsmail.test is then retired and drops out of your lists. This cannot be undone.'
    );
    expect(words.action).toBe('Merge the two records');
  });

  it('uses the names when they differ', () => {
    const words = mergeConfirmWords(
      { name: 'Desmond Achterberg', email: null, phone: null },
      { name: 'Des Achterberg', email: null, phone: null }
    );
    expect(words.title).toBe('Merge Des Achterberg into Desmond Achterberg?');
    expect(words.action).toBe('Merge into Desmond Achterberg');
  });
});
