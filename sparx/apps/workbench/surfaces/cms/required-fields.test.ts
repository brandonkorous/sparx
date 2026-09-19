import { describe, expect, it } from 'vitest';
import { missingRequired, missingRequiredNote, type RequiredFieldSpec } from './required-fields';

/**
 * "COULD NOT CREATE THIS", OVER ONE EMPTY BOX.
 *
 * An Event has Title, Description and Starts required. Leave Starts empty and
 * the whole answer is the surface's own fallback, naming nothing, with nothing
 * marked on a form long enough to need scrolling twice. The server DID name it
 * — `body.startAt` in its per-field details — and `apiErrorMessage` throws that
 * away, correctly, because a business owner reading a schema path learns
 * nothing. The content type carries `label: 'Starts'` for that very key.
 */
const EVENT: RequiredFieldSpec[] = [
  { key: 'title', label: 'Title', required: true },
  { key: 'description', label: 'Description', required: true },
  { key: 'startAt', label: 'Starts', required: true },
  { key: 'endAt', label: 'Ends' },
  { key: 'location', label: 'Location' },
  { key: 'isVirtual', label: 'Virtual event' },
];

const FILLED = {
  title: 'Autumn sample sale',
  description: { type: 'doc', content: [] },
  startAt: '2026-10-03T10:00:00.000Z',
};

describe('missingRequired', () => {
  it('names the one box she left empty', () => {
    const { startAt: _omitted, ...withoutStart } = FILLED;
    expect(missingRequired(EVENT, withoutStart)).toEqual(['Starts']);
  });

  it('says nothing when everything required is there', () => {
    expect(missingRequired(EVENT, FILLED)).toEqual([]);
  });

  it('ignores the optional ones, however empty', () => {
    expect(missingRequired(EVENT, FILLED)).toEqual([]);
  });

  it('names them in the order they appear on the form', () => {
    // Read down the page the way her eye does, not alphabetically.
    expect(missingRequired(EVENT, {})).toEqual(['Title', 'Description', 'Starts']);
  });

  it('counts a zero as filled in', () => {
    // A price of zero is a price. A check that called it empty would refuse to
    // let her save a free thing.
    const fields: RequiredFieldSpec[] = [{ key: 'price', label: 'Price', required: true }];
    expect(missingRequired(fields, { price: 0 })).toEqual([]);
  });

  it('counts an unticked box as filled in', () => {
    const fields: RequiredFieldSpec[] = [{ key: 'inStock', label: 'In stock', required: true }];
    expect(missingRequired(fields, { inStock: false })).toEqual([]);
  });

  it('has nothing to say about a type with no required fields', () => {
    expect(missingRequired([{ key: 'note', label: 'Note' }], {})).toEqual([]);
  });
});

describe('missingRequiredNote', () => {
  it('names one box plainly', () => {
    const { startAt: _omitted, ...withoutStart } = FILLED;
    expect(missingRequiredNote(EVENT, withoutStart)).toBe(
      'Starts needs filling in before this can be saved.'
    );
  });

  it('names two', () => {
    expect(missingRequiredNote(EVENT, { title: 'Autumn sample sale' })).toBe(
      'Description and Starts need filling in before this can be saved.'
    );
  });

  it('names three, the way it is said aloud', () => {
    expect(missingRequiredNote(EVENT, {})).toBe(
      'Title, Description and Starts need filling in before this can be saved.'
    );
  });

  it('is quiet when there is nothing to say', () => {
    expect(missingRequiredNote(EVENT, FILLED)).toBeNull();
  });
});
