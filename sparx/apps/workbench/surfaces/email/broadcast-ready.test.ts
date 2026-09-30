// A LIST SEND MAY NOT LEAVE WITHOUT THE ADDRESS THE LAW WANTS IN IT.
//
// Juniper Row sent to 23 people with the box empty, and three comments in the
// codebase said that was impossible.

import { describe, expect, it } from 'vitest';

import { hasMailingAddress, missingPieces, type ReadinessFacts } from './broadcast-ready';

/** A broadcast with nothing wrong with it except what a test changes. */
const sound: ReadinessFacts = {
  name: 'Autumn drop announcement',
  subject: 'The autumn pieces are up',
  segmentId: 'seg-1',
  builderEmailId: 'mail-1',
  emailUnpublished: false,
  emailBuiltIn: false,
  recipientCount: 23,
  mailingAddress: '12 Juniper Row\nBristol BS1 4TR\nUnited Kingdom',
};

const facts = (over: Partial<ReadinessFacts> = {}): ReadinessFacts => ({ ...sound, ...over });

describe('the mailing address the law wants', () => {
  it('stops the send that actually went out', () => {
    // 23 people, box empty, every check green.
    const missing = missingPieces(facts({ mailingAddress: null }));
    expect(missing).toHaveLength(1);
    expect(missing[0]).toContain('mailing address');
  });

  it('treats a box of spaces as empty', () => {
    for (const blank of ['', '   ', '\n\t ']) {
      expect(missingPieces(facts({ mailingAddress: blank })), JSON.stringify(blank)).toHaveLength(
        1
      );
    }
  });

  it('says WHERE it is, because it is not a field on this screen', () => {
    // Every other entry is something to fix on the compose screen. This one
    // reads as a box she cannot find unless it says so.
    const [only] = missingPieces(facts({ mailingAddress: null }));
    expect(only).toContain('email settings');
    expect(only).toContain('the law requires');
  });

  it('does not report missing while the settings are still loading', () => {
    // Undefined is "not known yet", not "blank". Reporting it would flash a
    // legal warning at somebody whose address is on file.
    expect(missingPieces(facts({ mailingAddress: undefined }))).toEqual([]);
    expect(hasMailingAddress(undefined)).toBe(undefined);
  });

  it('lets a filled address through', () => {
    expect(missingPieces(sound)).toEqual([]);
    expect(hasMailingAddress('12 Juniper Row')).toBe(true);
    expect(hasMailingAddress(null)).toBe(false);
  });
});

describe('a built-in email chosen for a list', () => {
  it('stops a draft that already points at one', () => {
    // A draft saved before the picker filtered them out still holds the id of,
    // say, "Payment failed". Sending it would tell a whole list their payment
    // failed, so it is one more thing standing between her and Send.
    const missing = missingPieces(facts({ emailBuiltIn: true }));
    expect(missing).toHaveLength(1);
    expect(missing[0]).toContain('an email you wrote yourself');
  });

  it('lets an email she wrote through', () => {
    expect(missingPieces(facts({ emailBuiltIn: false }))).toEqual([]);
  });
});

describe('the pieces that were already checked', () => {
  it('still names each one', () => {
    const cases: [Partial<ReadinessFacts>, string][] = [
      [{ name: '  ' }, 'a name'],
      [{ subject: '' }, 'a subject line'],
      [{ segmentId: '' }, 'who it goes to'],
      [{ builderEmailId: '' }, 'an email to send'],
      [{ emailUnpublished: true }, 'a published email (this one is still a draft)'],
      [{ recipientCount: 0 }, 'an audience with people in it'],
    ];
    for (const [over, expected] of cases) {
      expect(missingPieces(facts(over)), expected).toContain(expected);
    }
  });

  it('does not ask for an audience before one is chosen', () => {
    // With no segment there is no count to be zero, and saying "an audience
    // with people in it" as well as "who it goes to" is one complaint twice.
    const missing = missingPieces(facts({ segmentId: '', recipientCount: 0 }));
    expect(missing).toContain('who it goes to');
    expect(missing).not.toContain('an audience with people in it');
  });

  it('reports every fault at once rather than one at a time', () => {
    const missing = missingPieces({
      name: '',
      subject: '',
      segmentId: '',
      builderEmailId: '',
      emailUnpublished: false,
      emailBuiltIn: false,
      recipientCount: undefined,
      mailingAddress: null,
    });
    expect(missing).toHaveLength(5);
  });

  it('puts the settings one last, where the sentence reads as an aside', () => {
    const missing = missingPieces(facts({ name: '', mailingAddress: null }));
    expect(missing[0]).toBe('a name');
    expect(missing[missing.length - 1]).toContain('mailing address');
  });
});
