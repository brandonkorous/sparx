import { describe, expect, it } from 'vitest';

import {
  classifyMoved,
  classifyWrite,
  hasAnswer,
  type ClassifyForm,
  type StoredClassification,
} from './classify-by-hand';

const form = (over: Partial<ClassifyForm> = {}): ClassifyForm => ({
  abc: '',
  xyz: '',
  reason: '',
  ...over,
});

const stored = (over: Partial<StoredClassification> = {}): StoredClassification => ({
  abcOverride: null,
  xyzOverride: null,
  overrideReason: null,
  ...over,
});

describe('classifyWrite', () => {
  it('sends nulls when both pickers are left to the numbers', () => {
    expect(classifyWrite(form())).toEqual({ abcClass: null, xyzClass: null });
  });

  it('sends the chosen band on each axis', () => {
    expect(classifyWrite(form({ abc: 'A', xyz: 'X' }))).toEqual({
      abcClass: 'A',
      xyzClass: 'X',
    });
  });

  it('answers one axis and leaves the other measured', () => {
    expect(classifyWrite(form({ abc: 'A' }))).toEqual({ abcClass: 'A', xyzClass: null });
    expect(classifyWrite(form({ xyz: 'Z' }))).toEqual({ abcClass: null, xyzClass: 'Z' });
  });

  it('carries the reason when something is being set by hand', () => {
    expect(classifyWrite(form({ abc: 'A', reason: 'We are known for this one.' }))).toEqual({
      abcClass: 'A',
      xyzClass: null,
      reason: 'We are known for this one.',
    });
  });

  // A reason attached to nothing is a sentence explaining a decision nobody
  // took. Stored, it would make the record read as though one had been.
  it('drops a reason when neither axis is being answered', () => {
    const written = classifyWrite(form({ reason: 'We are known for this one.' }));
    expect(written).toEqual({ abcClass: null, xyzClass: null });
    expect('reason' in written).toBe(false);
  });

  it('treats a reason of spaces as no reason', () => {
    const written = classifyWrite(form({ abc: 'B', reason: '   ' }));
    expect(written).toEqual({ abcClass: 'B', xyzClass: null });
    expect('reason' in written).toBe(false);
  });

  it('trims the edges of a real reason', () => {
    expect(classifyWrite(form({ abc: 'B', reason: '  We make these.  ' })).reason).toBe(
      'We make these.'
    );
  });
});

describe('classifyMoved', () => {
  // Opening a dialog and closing it again is not an edit. Saving one anyway
  // would stamp a fresh date on a record nobody touched.
  it('is false when the form matches what is stored', () => {
    expect(classifyMoved(form(), stored())).toBe(false);
    expect(
      classifyMoved(
        form({ abc: 'A', reason: 'We are known for this one.' }),
        stored({ abcOverride: 'A', overrideReason: 'We are known for this one.' })
      )
    ).toBe(false);
  });

  it('is true when a band changes', () => {
    expect(classifyMoved(form({ abc: 'A' }), stored())).toBe(true);
    expect(classifyMoved(form({ abc: 'B' }), stored({ abcOverride: 'A' }))).toBe(true);
    expect(classifyMoved(form({ xyz: 'X' }), stored())).toBe(true);
  });

  // Changing only the words is still a change: the reason is the part somebody
  // reads a year later.
  it('is true when only the reason changes', () => {
    expect(
      classifyMoved(
        form({ abc: 'A', reason: 'It is in the window all summer.' }),
        stored({ abcOverride: 'A', overrideReason: 'We are known for this one.' })
      )
    ).toBe(true);
  });

  it('is true when an answer is being taken off', () => {
    expect(classifyMoved(form(), stored({ abcOverride: 'A' }))).toBe(true);
  });
});

describe('hasAnswer', () => {
  it('is false when nothing was ever set by hand', () => {
    expect(hasAnswer(stored())).toBe(false);
  });

  it('is true when either axis was set', () => {
    expect(hasAnswer(stored({ abcOverride: 'C' }))).toBe(true);
    expect(hasAnswer(stored({ xyzOverride: 'X' }))).toBe(true);
  });

  // A reason cannot exist without a band, so a lone reason is not an answer to
  // put back. If one is ever found, the button would offer to undo nothing.
  it('is false for a stray reason with no band behind it', () => {
    expect(hasAnswer(stored({ overrideReason: 'left over' }))).toBe(false);
  });
});
