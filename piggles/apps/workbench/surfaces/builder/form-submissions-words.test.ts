// Which form a message came from, in one line.
//
// Pinned because this column said "Untitled form" on every row of every site for
// months (issue 353): a form's name has no console surface, so it is never set,
// and the column that exists to tell three forms apart told an owner nothing.

import { describe, expect, it } from 'vitest';
import { formLabel, formName, formNamer, pageLabel } from './form-submissions-words';

describe('formName', () => {
  it('is null when there is no name, including a blank one', () => {
    // Length-checked rather than truthy-checked: `?? null` would keep an empty
    // string and render a blank cell, which reads as a rendering fault.
    expect(formName({ formName: null })).toBeNull();
    expect(formName({ formName: '' })).toBeNull();
    expect(formName({ formName: '   ' })).toBeNull();
  });

  it('trims a real name', () => {
    expect(formName({ formName: '  Stockist enquiries ' })).toBe('Stockist enquiries');
  });
});

describe('pageLabel', () => {
  it('says Home page for the slugless page', () => {
    expect(pageLabel(null)).toBe('Home page');
    expect(pageLabel('')).toBe('Home page');
    expect(pageLabel('   ')).toBe('Home page');
  });

  it('renders a real slug as an address', () => {
    expect(pageLabel('contact')).toBe('/contact');
  });
});

describe('formLabel', () => {
  it('falls back to the page, never to a placeholder', () => {
    expect(formLabel({ formName: null, pageSlug: 'contact' })).toBe('/contact');
    expect(formLabel({ formName: null, pageSlug: null })).toBe('Home page');
  });

  it('prefers the name when there is one', () => {
    expect(formLabel({ formName: 'Stockist enquiries', pageSlug: 'contact' })).toBe(
      'Stockist enquiries'
    );
  });
});

describe('formNamer names a row by the FORM, not by the row', () => {
  // A name is snapshotted onto each submission at submit time, so a form named
  // after somebody has already used it splits into two in one inbox: the messages
  // that arrived before the name wear the page address instead (issue 372).
  const CONTACT = '1dcebea2-5350-4744-b222-73c27f9c1613';
  const forms = [
    {
      formNodeId: CONTACT,
      formName: 'Messages from my website',
      pageSlug: 'contact',
      count: 4,
    },
  ];

  it('gives the current name to a row that predates it', () => {
    const name = formNamer(forms);
    expect(name({ formNodeId: CONTACT, formName: null, pageSlug: 'contact' })).toBe(
      'Messages from my website'
    );
  });

  it('gives every row of one form the same answer', () => {
    const name = formNamer(forms);
    const before = { formNodeId: CONTACT, formName: null, pageSlug: 'contact' };
    const after = {
      formNodeId: CONTACT,
      formName: 'Messages from my website',
      pageSlug: 'contact',
    };
    expect(name(before)).toBe(name(after));
  });

  it('prefers a stale snapshot to nothing when the form is gone from the page', () => {
    // Deleted from the site, so it is not in `forms` at all — but its messages are
    // still in the inbox and still have to say where they came from.
    const name = formNamer([]);
    expect(name({ formNodeId: 'deleted', formName: 'Stockist enquiries', pageSlug: 'trade' })).toBe(
      'Stockist enquiries'
    );
    expect(name({ formNodeId: 'deleted', formName: null, pageSlug: 'trade' })).toBe('/trade');
  });
});
