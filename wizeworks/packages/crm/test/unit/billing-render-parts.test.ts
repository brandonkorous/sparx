// The bill-to / ship-to block on a printed document.
//
// `partyFromJson` is what all THREE render paths use — the live document, the
// frozen snapshot, and the unsaved draft preview — so a line that is lost here
// is lost on the customer's copy, the PDF and the preview at once.
//
// The case these exist for: the console collects a billing address in a TEXTAREA
// whose placeholder shows two lines, so the stored string holds the newlines the
// person typed. Pushed as one line, HTML turns each newline into a space and the
// address prints as one run. Measured 2026-09-22 on INV-000018, where the
// SELLER address directly above printed on three lines because it arrives as an
// array. Issue 774.

import { describe, expect, it } from 'vitest';

import { partyFromJson } from '../../src/services/billing-render-parts';

describe('partyFromJson', () => {
  it('prints a typed address on the lines it was typed on', () => {
    const party = partyFromJson(
      {
        name: 'Tamsin Vale',
        email: 'tamsin@loomandlarder.com',
        address: '2140 NE Alberta St\nPortland, OR 97211\nUS',
      },
      'Bill to'
    );

    expect(party).toEqual({
      heading: 'Bill to',
      name: 'Tamsin Vale',
      lines: ['2140 NE Alberta St', 'Portland, OR 97211', 'US', 'tamsin@loomandlarder.com'],
    });
  });

  it('splits a pre-split line that itself holds a break', () => {
    const party = partyFromJson(
      { name: 'Acme Co', lines: ['Unit 4\nIndustrial Way', 'Leeds'] },
      'Ship to'
    );

    expect(party?.lines).toEqual(['Unit 4', 'Industrial Way', 'Leeds']);
  });

  it('handles the Windows line ending a pasted address carries', () => {
    const party = partyFromJson({ name: 'Acme Co', address: 'One St\r\nTwo Town' }, 'Bill to');

    expect(party?.lines).toEqual(['One St', 'Two Town']);
  });

  it('drops blank lines rather than printing an empty row', () => {
    const party = partyFromJson({ name: 'Acme Co', address: 'One St\n\n   \nTwo Town' }, 'Bill to');

    expect(party?.lines).toEqual(['One St', 'Two Town']);
  });

  it('still builds a block from the discrete fields', () => {
    const party = partyFromJson(
      {
        company: 'Loom and Larder',
        attention: 'Tamsin',
        line1: '2140 NE Alberta St',
        city: 'Portland',
        state: 'OR',
        postalCode: '97211',
        country: 'US',
        phone: '503-555-0134',
      },
      'Bill to'
    );

    expect(party).toEqual({
      heading: 'Bill to',
      name: 'Loom and Larder',
      lines: ['Attn: Tamsin', '2140 NE Alberta St', 'Portland, OR 97211', 'US', '503-555-0134'],
    });
  });

  // A comma after the town, a SPACE before the code. Joining all three with a
  // comma printed "Portland, OR, 97211" on the two documents whose address block
  // came from discrete fields rather than the textarea.
  it.each([
    [{ city: 'Portland', state: 'OR', postalCode: '97211' }, 'Portland, OR 97211'],
    [{ city: 'Visalia', region: 'CA', zip: '93291' }, 'Visalia, CA 93291'],
    [{ city: 'Leeds', postalCode: 'LS1 4AP' }, 'Leeds LS1 4AP'],
    [{ city: 'Portland', state: 'OR' }, 'Portland, OR'],
    [{ postalCode: '97211' }, '97211'],
  ])('writes the town line as an address is written: %o', (fields, expected) => {
    expect(partyFromJson({ name: 'Acme Co', ...fields }, 'Bill to')?.lines).toEqual([expected]);
  });

  // A checkout-captured ship-to names the person under `recipientName`, and
  // nothing read it — so the block printed an address with nobody on it.
  it('names the person a shipment is going to', () => {
    const party = partyFromJson(
      {
        recipientName: 'Marguerite Adeyemi',
        line1: '1184 SE Ash St',
        line2: '',
        city: 'Portland',
        region: 'OR',
        postalCode: '97214',
        country: 'US',
        phone: '',
      },
      'Ship to'
    );

    expect(party).toEqual({
      heading: 'Ship to',
      name: 'Marguerite Adeyemi',
      lines: ['1184 SE Ash St', 'Portland, OR 97214', 'US'],
    });
  });

  it('prefers an explicitly printed name over the recipient name', () => {
    const party = partyFromJson(
      { name: 'Loom and Larder', recipientName: 'Tamsin Vale' },
      'Ship to'
    );

    expect(party?.name).toBe('Loom and Larder');
  });

  it('returns nothing when there is nothing to print', () => {
    expect(partyFromJson({}, 'Bill to')).toBeNull();
    expect(partyFromJson(null, 'Bill to')).toBeNull();
    expect(partyFromJson({ address: '   \n  ' }, 'Bill to')).toBeNull();
  });
});
