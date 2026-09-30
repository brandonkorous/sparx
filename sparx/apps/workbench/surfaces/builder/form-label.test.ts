// AN UNNAMED FORM IS NAMED BY ITS PAGE, NOT "UNTITLED FORM".
//
// The inbox's Form column and its "which form" picker exist to tell forms apart,
// and every unnamed form read "Untitled form" in both while the page it sits on
// was on the row and on the picker's list, drawn nowhere there.

import { describe, expect, it } from 'vitest';

import { formLabel, formName, formNamer, type SubmissionFormRef } from './form-submissions-data';

describe('formLabel', () => {
  it('uses the name when the owner gave one', () => {
    expect(formLabel({ formName: ' Wholesale enquiries ', pageSlug: 'contact' })).toBe(
      'Wholesale enquiries'
    );
  });

  it('falls back to the page the form sits on', () => {
    expect(formLabel({ formName: null, pageSlug: 'contact' })).toBe('/contact');
    expect(formLabel({ formName: '  ', pageSlug: null })).toBe('Home page');
  });

  it('never says "Untitled form"', () => {
    expect(formLabel({ formName: null, pageSlug: 'book' })).not.toContain('Untitled');
  });
});

describe('formName', () => {
  it('is null when nobody named it, so a line does not repeat the page', () => {
    expect(formName({ formName: '' })).toBeNull();
  });
});

describe('formNamer', () => {
  const forms: SubmissionFormRef[] = [
    { formNodeId: 'n1', formName: 'Messages from my website', pageSlug: 'contact', count: 4 },
    { formNodeId: 'n2', formName: null, pageSlug: 'book', count: 2 },
  ];
  const label = formNamer(forms);

  it('names a row by its form as it is called today, not the copy on the row', () => {
    expect(label({ formNodeId: 'n1', formName: null, pageSlug: 'contact' })).toBe(
      'Messages from my website'
    );
  });

  it('names an unnamed form by its page', () => {
    expect(label({ formNodeId: 'n2', formName: null, pageSlug: 'book' })).toBe('/book');
  });

  it('falls back to the row for a form no longer on the site', () => {
    expect(label({ formNodeId: 'gone', formName: 'Old quote form', pageSlug: null })).toBe(
      'Old quote form'
    );
  });
});
