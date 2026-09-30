// A FILTER THE PANE SET IS NOT A FILTER THE PERSON SET.
//
// Both moderation panes open on their waiting queue and then reported that
// default back as if the reader had chosen it:
//
//     Nothing matches those filters
//     Try a different word, or switch the filter back to All.
//
// on a pane nobody had touched. The reviews pane fixed that and left the rule in
// a comment; its sibling Questions, same folder, same `pending` default, was
// left behind.
//
// And the reviews fix still had a third state missing: "switch the filter to All
// to see the ones already on your website" points at a second empty screen for a
// shop that has never had one. Measured: 43 tenants have the store switched on
// and only 10 have ever had a question or a review.

import { describe, expect, it } from 'vitest';
import { UNANSWERED_FILTER } from './question-answers';
import {
  moderationEmptyWords,
  type ModerationEmptyInput,
  type ModerationKind,
} from './moderation-empty';

function input(over: Partial<ModerationEmptyInput> = {}): ModerationEmptyInput {
  return { searching: false, status: 'pending', defaultStatus: 'pending', everCount: 3, ...over };
}

const KINDS: ModerationKind[] = ['question', 'review'];

describe('opening the pane cold', () => {
  it('does not blame a filter nobody set', () => {
    for (const kind of KINDS) {
      const words = moderationEmptyWords(kind, input());
      expect(words.title, kind).not.toBe('Nothing matches those filters');
      expect(words.detail, kind).not.toContain('Try a different word');
    }
  });

  it('says the queue is clear when there is history behind it', () => {
    const words = moderationEmptyWords('review', input({ everCount: 12 }));
    expect(words.title).toBe('Nothing waiting for you');
    expect(words.detail).toContain('Switch the filter to All');
  });

  it('does not send somebody to a second empty screen', () => {
    // 33 of the 43 shops on the platform, today.
    for (const kind of KINDS) {
      const words = moderationEmptyWords(kind, input({ everCount: 0 }));
      expect(words.detail, kind).not.toContain('Switch the filter to All');
      expect(words.detail, kind).toContain('Nobody has left one');
    }
  });
});

describe('a search the person typed', () => {
  it('is the one case where "try a different word" is real advice', () => {
    for (const everCount of [0, 5, null]) {
      const words = moderationEmptyWords('question', input({ searching: true, everCount }));
      expect(words.title, String(everCount)).toBe('Nothing matches those filters');
      expect(words.detail, String(everCount)).toContain('Try a different word');
    }
  });
});

describe('a status the person chose', () => {
  it('is reported as a filter, because it is one', () => {
    const words = moderationEmptyWords('review', input({ status: 'rejected' }));
    expect(words.title).toBe('Nothing matches those filters');
  });

  it('is still not reported as one when nothing has ever arrived', () => {
    // Switching the filter cannot conjure a review that was never written, so
    // the honest answer outranks the filter even here.
    const words = moderationEmptyWords('review', input({ status: 'rejected', everCount: 0 }));
    expect(words.title).toBe('No reviews yet');
  });
});

describe('the words themselves', () => {
  it('name the right thing for each pane', () => {
    expect(moderationEmptyWords('question', input({ everCount: 0 })).title).toBe(
      'No questions yet'
    );
    expect(moderationEmptyWords('review', input({ everCount: 0 })).title).toBe('No reviews yet');
    expect(moderationEmptyWords('question', input({ everCount: 0 })).detail).toContain(
      'asks a question about one of your products'
    );
    expect(moderationEmptyWords('review', input({ everCount: 0 })).detail).toContain(
      'reviews one of your products'
    );
  });

  it('keeps the singular singular on the waiting queue', () => {
    expect(moderationEmptyWords('question', input()).detail).toContain('No question is waiting');
    expect(moderationEmptyWords('review', input()).detail).toContain('No review is waiting');
  });
});

describe('the property', () => {
  it('never blames a filter the reader did not set', () => {
    // Whatever the shape of the input, the sentence and the state must agree:
    // "those filters" may appear only when the reader typed a search or moved
    // the status off the one the pane opened with.
    const shapes: Partial<ModerationEmptyInput>[] = [
      {},
      { everCount: 0 },
      { everCount: null },
      { status: 'all' },
      { status: 'all', everCount: 0 },
      { status: 'rejected' },
      { status: 'rejected', everCount: 0 },
      { searching: true },
      { searching: true, everCount: 0 },
    ];
    for (const shape of shapes) {
      const args = input(shape);
      const words = moderationEmptyWords('question', args);
      const theyFiltered =
        args.searching || (args.status !== args.defaultStatus && args.status !== 'all');
      const blamed = words.title === 'Nothing matches those filters';
      // Except: a business with nothing at all is told so whatever the status,
      // because no filter can change that.
      const expected = theyFiltered && !(args.everCount === 0 && !args.searching);
      expect(blamed, JSON.stringify(shape)).toBe(expected);
    }
  });
});

describe('the view that is not a status', () => {
  const unanswered = (over: Partial<ModerationEmptyInput> = {}) =>
    input({ status: UNANSWERED_FILTER, everCount: 4, ...over });

  it('calls an empty "No answer yet" good news, not a filter to widen', () => {
    // The whole point. Falling through to the generic branch would tell her to
    // try a different word she never typed, about a view that is empty because
    // the work is done. [[feedback_one_outcome_two_causes]]
    const words = moderationEmptyWords('question', unanswered());
    expect(words.title).toBe('Every question has an answer');
    expect(words.detail).not.toContain('different word');
  });

  it('still says nobody has ever asked, when nobody has', () => {
    // A shop with no questions at all must not be congratulated on answering
    // them. The count past every filter wins over the view.
    expect(moderationEmptyWords('question', unanswered({ everCount: 0 })).title).toBe(
      'No questions yet'
    );
  });

  it('leaves reviews alone, which have no answers axis', () => {
    expect(moderationEmptyWords('review', unanswered()).title).toBe(
      'Nothing matches those filters'
    );
  });
});
