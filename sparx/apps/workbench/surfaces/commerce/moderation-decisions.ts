// A SCREEN DOES NOT OFFER A BUTTON THAT CANNOT DO ANYTHING.
//
// Four surfaces draw the publish/hide pair — the reviews table, the reviews
// queue, the questions table, the questions queue — and every one of them drew
// BOTH, on every row, whatever the row already said. So a shop opened Reviews,
// switched the filter to All as the empty state told it to, and every published
// review carried a green tick reading "Publish it".
//
// Pressing it was not harmless. The service re-stamped `moderatedAt` and
// appended a second `approved` entry to the moderation log, so her own record of
// that review said she approved it twice, three weeks apart, over a button that
// could not change anything (issue 640). The service no longer writes that; this
// module is the other half, because a control that does nothing is still a
// control she has to work out.
//
// The questions queue is the sharp version of the mistake: it reads the row's
// status into a variable, paints the status badge from it, and then draws both
// decisions underneath as though it had never asked.
//
// 111 of 129 reviews on this platform are already published, and 54 of 65
// questions. This is the ordinary row, not the edge one.
//
// Pure and React-free: `icon` is a KEY the surface maps to its own glyph, so
// this module can be unit-tested with no renderer.

import type { ModerationKind } from './moderation-empty';

export type ReviewDecision = 'approved' | 'rejected';
export type QuestionDecision = 'published' | 'rejected';

export interface DecisionAction<TNext extends string> {
  /** The status this button asks for. */
  next: TNext;
  /** `show` is the tick, `hide` is the crossed-out eye. */
  icon: 'show' | 'hide';
  /** On the button, where there is room for words. */
  label: string;
  /** The tooltip, where there is not. */
  tooltip: string;
  /** The accessible name, which has to name the thing as well as the act. */
  aria: string;
  /** What the toast says once it has worked. */
  done: string;
}

const HIDE_REVIEW: DecisionAction<ReviewDecision> = {
  next: 'rejected',
  icon: 'hide',
  label: 'Hide',
  tooltip: 'Take it off your website',
  aria: 'Hide this review',
  done: 'Review hidden',
};

const PUBLISH_REVIEW: DecisionAction<ReviewDecision> = {
  next: 'approved',
  icon: 'show',
  label: 'Publish it',
  tooltip: 'Put it on your website',
  aria: 'Publish this review',
  done: 'Review published',
};

// Not "Publish it". From her side, bringing back something she took down is not
// a first publication, and calling it one loses the only detail that tells the
// two moments apart.
const RESHOW_REVIEW: DecisionAction<ReviewDecision> = {
  next: 'approved',
  icon: 'show',
  label: 'Show it again',
  tooltip: 'Put it back on your website',
  aria: 'Show this review again',
  done: 'Review shown again',
};

const HIDE_QUESTION: DecisionAction<QuestionDecision> = {
  next: 'rejected',
  icon: 'hide',
  label: 'Hide',
  tooltip: 'Take it off the product page',
  aria: 'Hide this question',
  done: 'Question hidden',
};

const PUBLISH_QUESTION: DecisionAction<QuestionDecision> = {
  next: 'published',
  icon: 'show',
  label: 'Show it on the page',
  tooltip: 'Show on the page',
  aria: 'Show this question on the page',
  done: 'Question shown on the page',
};

const RESHOW_QUESTION: DecisionAction<QuestionDecision> = {
  next: 'published',
  icon: 'show',
  label: 'Show it again',
  tooltip: 'Put it back on the product page',
  aria: 'Show this question again',
  done: 'Question shown again',
};

/**
 * What this review may be asked to do next, given where it already is.
 *
 * `pending`, `flagged` and anything unrecognised get both, because a row in a
 * state this console does not know about is a row where both decisions are still
 * open — never a row with no way out.
 */
export function reviewDecisions(status: string): DecisionAction<ReviewDecision>[] {
  if (status === 'approved') return [HIDE_REVIEW];
  if (status === 'rejected') return [RESHOW_REVIEW];
  return [PUBLISH_REVIEW, HIDE_REVIEW];
}

/** The same rule for a customer's question. */
export function questionDecisions(status: string): DecisionAction<QuestionDecision>[] {
  if (status === 'published') return [HIDE_QUESTION];
  if (status === 'rejected') return [RESHOW_QUESTION];
  return [PUBLISH_QUESTION, HIDE_QUESTION];
}

export interface BulkOutcome {
  /**
   * How many rows actually MOVED. Named as the endpoint and the service name it,
   * so the number keeps one name from the database to the toast — it used to be
   * "how many ids did not fail", which is why the words below exist.
   */
  count: number;
  /** How many were already in the state that was asked for. */
  unchanged: number;
}

export interface BulkWords {
  title: string;
  description?: string;
  type: 'success' | 'info';
}

/** "shown" / "hidden" — how to describe the state the rows were already in. */
const ALREADY: Record<ModerationKind, Record<string, string>> = {
  review: { approved: 'shown', rejected: 'hidden' },
  question: { published: 'shown', rejected: 'hidden' },
};

/**
 * What to say after a bulk decision, counting only what moved.
 *
 * The bulk helpers used to count every id that did not throw, so selecting three
 * already-shown reviews and pressing Show reported "Shown (3)" over three rows
 * nothing had happened to.
 */
export function bulkDecisionWords(
  kind: ModerationKind,
  next: string,
  outcome: BulkOutcome
): BulkWords {
  const state = ALREADY[kind][next] ?? 'set that way';
  const done = state === 'shown' ? 'Shown' : 'Hidden';

  if (outcome.count === 0) {
    const n = outcome.unchanged;
    return {
      title: 'Nothing to change',
      description:
        n === 1
          ? `That one was already ${state}.`
          : `All ${String(n)} of them were already ${state}.`,
      type: 'info',
    };
  }

  if (outcome.unchanged === 0) {
    return { title: `${done} (${String(outcome.count)})`, type: 'success' };
  }

  const n = outcome.unchanged;
  return {
    title: `${done} (${String(outcome.count)})`,
    description: n === 1 ? `1 was already ${state}.` : `${String(n)} were already ${state}.`,
    type: 'success',
  };
}

/**
 * What to say after ONE decision, when the server reports it changed nothing.
 *
 * Reachable without a stale screen: two people working the same queue, or a
 * second tab. The button that produced it has been removed from the row, so this
 * is the honest answer rather than the usual one.
 */
export function unchangedWords(kind: ModerationKind, next: string): BulkWords {
  const state = ALREADY[kind][next] ?? 'set that way';
  const noun = kind === 'review' ? 'review' : 'question';
  return {
    title: 'Nothing to change',
    description: `That ${noun} was already ${state}.`,
    type: 'info',
  };
}
