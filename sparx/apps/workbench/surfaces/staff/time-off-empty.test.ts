// AN EMPTY QUEUE MUST NOT CLAIM REQUESTS WERE ANSWERED WHEN THERE WERE NONE.
//
// Measured: one time-off request exists across the whole platform. Every other
// tenant saw "Every request has been answered."

import { describe, expect, it } from 'vitest';
import { timeOffEmptyWords } from './time-off-empty';

describe('timeOffEmptyWords', () => {
  it('says nobody has asked when nobody has asked', () => {
    // Juniper Row, and every tenant but one.
    const words = timeOffEmptyWords('requested', 0);
    expect(words.title).toBe('No time off asked for yet');
    expect(words.detail).toContain('Nobody has asked for time off');
    expect(words.detail).not.toContain('answered');
  });

  it('does not offer a second empty screen to look at', () => {
    // "Switch to Everything to see what has already been decided" sends someone
    // to another empty pane when nothing was ever decided.
    expect(timeOffEmptyWords('requested', 0).detail).not.toContain('Switch to Everything');
    expect(timeOffEmptyWords('approved', 0).detail).not.toContain('Switch to Everything');
  });

  it('counts the answered requests, singular', () => {
    const words = timeOffEmptyWords('requested', 1);
    expect(words.title).toBe('Nothing waiting on you');
    expect(words.detail).toContain('The one request on record has been answered');
    expect(words.detail).not.toContain('requests');
  });

  it('counts the answered requests, plural', () => {
    const words = timeOffEmptyWords('requested', 4);
    expect(words.detail).toContain('All 4 requests on record have been answered');
  });

  it('says nothing was approved rather than nothing is waiting', () => {
    const words = timeOffEmptyWords('approved', 3);
    expect(words.title).toBe('Nothing approved');
    expect(words.detail).toContain('None of the 3 requests');
    expect(words.detail).not.toContain('waiting');
  });

  it('never claims an answer on a queue with nothing in it', () => {
    // The property, not the case: a total of zero may not produce a sentence
    // that asserts something HAPPENED to a request. Phrases rather than bare
    // words — the empty state legitimately says approved dates show on the
    // schedule, which is a fact about the future, not a claim about a request.
    const claims = [
      'has been answered',
      'have been answered',
      'was not approved',
      'were approved',
      'on record',
      'what was decided',
      'already been decided',
    ];
    for (const filter of ['requested', 'approved', 'all', 'denied']) {
      const words = timeOffEmptyWords(filter, 0);
      for (const claim of claims) {
        expect(words.detail.toLowerCase(), `${filter} / ${claim}`).not.toContain(claim);
      }
    }
  });
});
