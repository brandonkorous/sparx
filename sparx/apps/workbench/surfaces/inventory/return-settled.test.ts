// A return that has been paid is not a return that is waiting (issue 888).
//
// On the development database RTV-000001 was credited in full, and the screen
// called "Sent back" said three outstanding things about it at once:
//
//     Waiting   2 weeks ago          ← the day the goods LEFT, under a heading
//                                      that asks how long a credit is overdue
//     Owed      $18.00               ← over the words "paid in full"
//     Stat      You are owed $18.00  ← beside "They have credited $18.00"
//
// Four inches above the first two, the toolbar read "Nothing outstanding" —
// correctly, because it is built from the server's `awaitingCreditCents`, which
// counts only `{ status: 'sent', creditReceivedCents: null }`. The summary and
// the rows on the same screen disagreed about the same return.
//
// ── WHY THE CELLS WENT WRONG ────────────────────────────────────────────────
//
// They branched on `awaitingCreditDays === null`. The server documents that
// field as "null before it is sent, and null once it is resolved", so the null
// covers THREE different returns and the cell was written for one of them: a
// draft that has not gone anywhere yet. A credited return fell into the same
// branch and inherited a sentence meant for a draft.
//
// The detail pane had already found this once and fixed the stat on the right.
// Its two neighbours — the stat on the left and the whole list — kept the bug,
// so the rule now lives in the data module where both screens read it.
// [[feedback_a_fix_leaves_its_neighbour_behind]]

import { describe, expect, it } from 'vitest';
import { returnClaimTitle, returnIsSettled, returnSettledTitle } from './supplier-returns-data';

// The five the server's own filter type names. If a sixth is ever added, the
// last test in this file is the one that should notice.
const STATUSES = ['draft', 'sent', 'credited', 'closed', 'cancelled'] as const;

describe('returnIsSettled - has this one finished?', () => {
  it('says a credited return has finished', () => {
    // THE DEFECT. This is the return on her screen.
    expect(returnIsSettled('credited')).toBe(true);
  });

  it('says a written-off return has finished', () => {
    // The narrow fix handles `credited` and stops. Written off is just as
    // finished: somebody decided the credit is not coming, which is the end of
    // the chase, not a reason to keep counting days against it.
    expect(returnIsSettled('closed')).toBe(true);
  });

  it('says a called-off return has finished', () => {
    expect(returnIsSettled('cancelled')).toBe(true);
  });

  it('says a return that is still out is NOT finished', () => {
    // The half that already worked and must not be traded away. This is the
    // only state the chase column exists for.
    expect(returnIsSettled('sent')).toBe(false);
  });

  it('says a draft is not finished either', () => {
    // Not finished and not waiting - it has never left the shelf. The cell says
    // "Not sent" for this one, which is the sentence the old code was written
    // for and the only one it was right about.
    expect(returnIsSettled('draft')).toBe(false);
  });

  it('treats a state it does not recognize as still open', () => {
    // Fail towards the chase. A status added later that nobody teaches this
    // function about must not quietly drop a return off the list of things
    // somebody still owes her.
    expect(returnIsSettled('some_future_state')).toBe(false);
  });
});

describe('returnClaimTitle - what the claim amount is called', () => {
  it('does not say she is owed money that has arrived', () => {
    // THE DEFECT, in words. The number under this heading is the size of the
    // claim and never moves; the heading has to carry whether it is still due.
    expect(returnClaimTitle('credited')).toBe('You asked for');
    expect(returnClaimTitle('closed')).toBe('You asked for');
    expect(returnClaimTitle('cancelled')).toBe('You asked for');
  });

  it('says she is owed it while the goods are out and nothing has come back', () => {
    expect(returnClaimTitle('sent')).toBe('You are owed');
  });

  it('does not say she is owed money she has not asked for yet', () => {
    // A draft has not gone anywhere. The supplier does not know about it.
    expect(returnClaimTitle('draft')).toBe('To claim back');
  });

  it('never tells her she is owed money on a finished return', () => {
    // The shape of the whole bug in one assertion: no ending may carry the
    // chasing word.
    for (const status of STATUSES) {
      if (!returnIsSettled(status)) continue;
      expect(returnClaimTitle(status)).not.toBe('You are owed');
    }
  });
});

describe('returnSettledTitle - naming the ending', () => {
  it('names each ending', () => {
    expect(returnSettledTitle('credited')).toBe('Credited');
    expect(returnSettledTitle('closed')).toBe('Written off');
    expect(returnSettledTitle('cancelled')).toBe('Called off');
  });

  it('gives nothing back while the return is still open', () => {
    // Null is the caller's signal to say "Waiting" instead, which is how the
    // detail pane picks between a duration and a date.
    expect(returnSettledTitle('draft')).toBeNull();
    expect(returnSettledTitle('sent')).toBeNull();
  });

  it('agrees with returnIsSettled about every state there is', () => {
    // The two rules are read by different screens and must never drift: a state
    // with a name for its ending IS an ending, and one without is not.
    for (const status of STATUSES) {
      expect(returnSettledTitle(status) !== null).toBe(returnIsSettled(status));
    }
  });
});
