// The sentences the store-credit pane says, and the two small decisions behind
// them, kept out of the component so both can be read back in a test.
//
// Store credit is money. Every sentence here is about a number a shop owner is
// either giving away or taking back, so each one names the amount, the person,
// or the reason the screen cannot do what was asked — never a shrug.

/* ── Which person is this? ──────────────────────────────────────────────── */

/** What the picker knows about someone. Every field is already on the wire. */
export interface PersonFacts {
  email?: string | null;
  company?: string | null;
  phone?: string | null;
  /** Already formatted for reading, e.g. `19 Sep 2026`. The component owns the
   *  locale; this module owns the sentence. */
  addedOn?: string | null;
}

/**
 * The line under a name in the customer picker.
 *
 * A name is not an identity. Juniper Row has two customers called Priya Anand,
 * and a picker that renders the name plus an email that one of them does not
 * have asks the owner to choose between a row that says "Priya Anand" and a row
 * that says "Priya Anand", then puts real money on the guess.
 *
 * NEVER returns an empty string. A blank second line is the exact failure this
 * fixes: it reads as a row with nothing much beside it rather than as a person
 * the screen cannot tell from the one above.
 */
export function whichPerson(person: PersonFacts): string {
  const parts: string[] = [];
  const company = person.company?.trim();
  const email = person.email?.trim();
  const phone = person.phone?.trim();

  // Company first. For a trade buyer it is the thing the owner recognizes —
  // "Loom & Larder" is who the credit is really for, and the person typing the
  // order changes.
  if (company) parts.push(company);
  if (email) parts.push(email);
  // Phone only when there is nothing better, so a row that already reads
  // clearly does not grow a third thing to scan past.
  if (!company && !email && phone) parts.push(phone);
  if (parts.length > 0) return parts.join(' · ');

  const added = person.addedOn?.trim();
  return added ? `No email or phone yet, added ${added}` : 'No email or phone yet';
}

/* ── Saying what just happened to the balance ───────────────────────────── */

/**
 * The line under a toast after the balance moves.
 *
 * Both endpoints answer with the new balance and the pane dropped it, so the
 * only confirmation was the word "added" — which says nothing about the amount
 * that landed. An amount is the one thing worth reading back after typing one,
 * and a mistyped grant is the reason the take-back path exists at all.
 */
export function balanceNote(amount: string, name: string, balance: string): string {
  return `${amount} for ${name}. Their balance is now ${balance}.`;
}

/* ── Can this much come back off? ───────────────────────────────────────── */

export interface TakeBackCheck {
  ok: boolean;
  /** Undefined while nothing has been typed — an empty box is not a mistake. */
  problem?: string;
}

/**
 * Whether this much can come off the balance, and what to say when it cannot.
 *
 * The server refuses an over-take and names the balance, and that refusal is
 * the backstop that matters. This gives the same answer BEFORE the press,
 * because learning "that is more than she holds" from a round trip is learning
 * it from the wrong place: the screen already knew.
 *
 * `amountCents` is `undefined` for an empty box, which is a different answer
 * from zero and must not read as a mistake.
 */
export function takeBackCheck(
  amountCents: number | undefined,
  balanceCents: number,
  balance: string
): TakeBackCheck {
  if (amountCents === undefined) return { ok: false };
  if (balanceCents <= 0) {
    return { ok: false, problem: 'There is nothing on this account to take back.' };
  }
  if (amountCents <= 0) return { ok: false, problem: 'Enter how much to take back.' };
  if (amountCents > balanceCents) {
    return { ok: false, problem: `That is more than ${balance}, which is all they hold.` };
  }
  return { ok: true };
}

/* ── What the picker is showing ─────────────────────────────────────────── */

export type PickerMood = 'prompt' | 'searching' | 'failed' | 'empty' | 'results';

export interface PickerState {
  mood: PickerMood;
  /** The whole message for every mood but `results`. */
  message?: string;
}

/**
 * Which of the five things the customer picker is doing.
 *
 * `failed` exists because it did not. The picker read `data` and `isFetching`
 * and nothing else, so a search the server never answered fell through to the
 * empty branch and said "No customer matches that. Try a different word." —
 * which is a statement about the shop's customer list, made when the shop's
 * customer list was never consulted. MEASURED 2026-09-19: seventeen requests to
 * `/v1/crm/customers` returned 503 while the pane reported, four times, that
 * Juniper Row had nobody called Marguerite. It has.
 *
 * The list card three inches below this one gets it right ("Could not load
 * balances"), in the same file, for the same reason.
 */
export function pickerState(input: {
  query: string;
  isError: boolean;
  isFetching: boolean;
  count: number;
}): PickerState {
  if (input.query.trim() === '') {
    return { mood: 'prompt', message: 'Start typing to find the customer to give credit to.' };
  }
  // Failure first. A failed search that is also refetching is still a failure,
  // and "Searching…" over a dead request is a spinner that never resolves.
  if (input.isError) {
    return {
      mood: 'failed',
      message:
        'Could not search your customers just now. Nothing is wrong with the name you typed. ' +
        'Try again in a moment.',
    };
  }
  if (input.isFetching && input.count === 0) return { mood: 'searching', message: 'Searching…' };
  if (input.count === 0) {
    return { mood: 'empty', message: 'No customer matches that. Try a different word.' };
  }
  return { mood: 'results' };
}
