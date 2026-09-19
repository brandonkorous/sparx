import { describe, expect, it } from 'vitest';
import {
  bulkDecisionWords,
  questionDecisions,
  reviewDecisions,
  unchangedWords,
} from './moderation-decisions';

// What this file is here to stop: a green tick reading "Publish it" on a review
// the row beside it calls Published. Pressing it re-stamped when she decided and
// wrote a second approval into her own record of that review (issue 640).

describe('what a review may be asked to do next', () => {
  it('never offers a decision the row is already in', () => {
    // The whole bug in one assertion. 111 of 129 reviews on this platform are
    // already published, so this is most rows, not an edge.
    expect(reviewDecisions('approved').map((d) => d.next)).toEqual(['rejected']);
    expect(reviewDecisions('rejected').map((d) => d.next)).toEqual(['approved']);
  });

  it('offers both while the decision is still open', () => {
    expect(reviewDecisions('pending').map((d) => d.next)).toEqual(['approved', 'rejected']);
    expect(reviewDecisions('flagged').map((d) => d.next)).toEqual(['approved', 'rejected']);
  });

  it('leaves a way out of a state it does not recognise', () => {
    // A row in a status this console has never heard of is a row where both
    // decisions are still open — never one with no buttons at all.
    expect(reviewDecisions('quarantined')).toHaveLength(2);
  });

  it('says "again" for one being brought back, not "publish"', () => {
    const back = reviewDecisions('rejected')[0];
    expect(back?.label).toBe('Show it again');
    expect(back?.done).toBe('Review shown again');
    // Calling the second showing a first publication loses the only detail that
    // tells the two moments apart.
    expect(back?.label).not.toContain('Publish');
  });

  it('gives every button a name that says what it acts on', () => {
    for (const status of ['pending', 'approved', 'rejected', 'flagged']) {
      for (const decision of reviewDecisions(status)) {
        expect(decision.aria, status).toContain('review');
      }
    }
  });
});

describe('what a question may be asked to do next', () => {
  it('never offers a decision the row is already in', () => {
    expect(questionDecisions('published').map((d) => d.next)).toEqual(['rejected']);
    expect(questionDecisions('rejected').map((d) => d.next)).toEqual(['published']);
    expect(questionDecisions('pending').map((d) => d.next)).toEqual(['published', 'rejected']);
  });

  it('talks about the product page, which is where a question goes', () => {
    const show = questionDecisions('pending')[0];
    expect(show?.label).toBe('Show it on the page');
  });
});

describe('what to say after deciding on several at once', () => {
  it('says how many MOVED, not how many were selected', () => {
    expect(bulkDecisionWords('review', 'approved', { count: 2, unchanged: 0 }).title).toBe(
      'Shown (2)'
    );
  });

  it('does not report work done when nothing moved', () => {
    // "Shown (3)" over three rows that were already shown is what this replaces.
    const words = bulkDecisionWords('review', 'approved', { count: 0, unchanged: 3 });
    expect(words.title).toBe('Nothing to change');
    expect(words.description).toBe('All 3 of them were already shown.');
    expect(words.type).toBe('info');
  });

  it('names the ones left behind in a mixed selection', () => {
    const words = bulkDecisionWords('question', 'published', { count: 2, unchanged: 1 });
    expect(words.title).toBe('Shown (2)');
    expect(words.description).toBe('1 was already shown.');
  });

  it('says hidden for the other direction', () => {
    expect(bulkDecisionWords('review', 'rejected', { count: 1, unchanged: 0 }).title).toBe(
      'Hidden (1)'
    );
    expect(bulkDecisionWords('review', 'rejected', { count: 0, unchanged: 1 }).description).toBe(
      'That one was already hidden.'
    );
  });
});

describe('what to say when one decision changed nothing', () => {
  it('names the thing and the state it was already in', () => {
    expect(unchangedWords('review', 'approved').description).toBe('That review was already shown.');
    expect(unchangedWords('question', 'rejected').description).toBe(
      'That question was already hidden.'
    );
  });
});
