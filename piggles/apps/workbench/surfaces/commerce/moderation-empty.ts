// A FILTER THE PANE SET IS NOT A FILTER THE PERSON SET.
//
// Both moderation panes open on their WAITING queue, which is the right default:
// the reason to click Reviews or Questions is almost always "is anything waiting
// on me". Both then computed `anyFilter` as `search !== '' || status !== 'all'`,
// which is TRUE the instant the pane loads, so a shop with nothing waiting read:
//
//     Nothing matches those filters
//     Try a different word, or switch the filter back to All.
//
// about a filter it had never touched, and was sent looking for a control that
// was already where it should be.
//
// The reviews pane fixed this and left a comment stating the rule — "A filter the
// PANE set is not a filter the person set" — and its SIBLING in the same folder,
// on the same queue idea, with the same `pending` default, was left behind.
//
// THE THIRD STATE THE REVIEWS FIX STILL MISSED. "Nothing is waiting. Switch the
// filter to All to see the ones already on your website" is the same shape one
// level down: it sends somebody to a second empty screen. Measured: 43 tenants
// have the store switched on, and only **10** have ever had a question or a
// review, so 33 of them would be pointed at a view with nothing in it either.
// Only a count taken past the pane's own filter can tell "all dealt with" from
// "nobody has ever asked", which is the same lesson as every other empty queue
// in this console.
//
// Pure, with one branch per state — a plural-only phrase reads fine in source
// and only breaks on screen.

import { UNANSWERED_FILTER } from './question-answers';

export type ModerationKind = 'question' | 'review';

export interface ModerationEmpty {
  title: string;
  detail: string;
}

export interface ModerationEmptyInput {
  /** The person typed something in the search box. */
  searching: boolean;
  /** The status filter as it stands. */
  status: string;
  /** The status the pane OPENS on, which nobody chose. */
  defaultStatus: string;
  /**
   * How many of these exist for the business at all, past every filter on this
   * pane — `null` while the answer has not arrived. NEVER the list's own `total`,
   * which carries the filter and so cannot answer this question.
   */
  everCount: number | null;
}

const NOUN: Record<ModerationKind, { one: string; many: string; verb: string }> = {
  question: {
    one: 'question',
    many: 'questions',
    verb: 'asks a question about one of your products',
  },
  review: { one: 'review', many: 'reviews', verb: 'reviews one of your products' },
};

export function moderationEmptyWords(
  kind: ModerationKind,
  input: ModerationEmptyInput
): ModerationEmpty {
  const noun = NOUN[kind];

  // A typed search matching nothing is the person's own doing, and is the one
  // case where "try a different word" is real advice.
  if (input.searching) {
    return {
      title: 'Nothing matches those filters',
      detail: 'Try a different word, or switch the filter back to All.',
    };
  }

  // Nothing has ever arrived. Said the same way whichever view is open, because
  // switching the view cannot change it.
  if (input.everCount === 0) {
    return {
      title: `No ${noun.many} yet`,
      detail:
        `Nobody has left one. When a customer ${noun.verb}, it appears here for you to publish ` +
        'or hide before it goes on your website.',
    };
  }

  if (input.status === input.defaultStatus) {
    // The queue the pane opened on, and there IS history to look at.
    return {
      title: 'Nothing waiting for you',
      detail:
        `No ${noun.one} is waiting to be published. Switch the filter to All to see the ones ` +
        'already on your website.',
    };
  }

  if (input.status === 'all') {
    // Every status, and still nothing — only reachable while the count is
    // unknown, since `everCount === 0` is handled above.
    return {
      title: `No ${noun.many} yet`,
      detail:
        `Nobody has left one. When a customer ${noun.verb}, it appears here for you to publish ` +
        'or hide before it goes on your website.',
    };
  }

  // "No answer yet" is not a status, and an empty one is the GOOD outcome —
  // every question has a reply. Falling through to the line below would tell her
  // to try a different word she never typed, about a view that is empty because
  // the work is done. [[feedback_one_outcome_two_causes]]
  if (kind === 'question' && input.status === UNANSWERED_FILTER) {
    return {
      title: 'Every question has an answer',
      detail:
        'Nothing is waiting on a reply from you. Switch the filter to All to read the ones you ' +
        'have already answered.',
    };
  }

  // A status the person chose themselves.
  return {
    title: 'Nothing matches those filters',
    detail: 'Try a different word, or switch the filter back to All.',
  };
}
