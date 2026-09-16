// WHAT THE RESULT TILES SAY, as pure rules.
//
// Split out of `broadcast-detail` so it can be TESTED. That file is React, and
// the console's test seat runs plain Node with no path aliases, so nothing
// importing a component can be reached by a test. The half worth guarding is
// here anyway: every decision below is a SENTENCE shown about somebody's mail,
// and a wrong sentence compiles exactly like a right one.
//
// THIS CONSOLE HAD THE UNFIXED VERSION. Three defects were found and closed on
// the other console's copy of this screen and never travelled here, which is
// what a rule living inside a component looks like from the outside: nothing.
//
//   246  "Delivered 0" a minute after twenty-three emails went out. Nothing had
//        failed; nothing had been CONFIRMED yet, which is a different thing.
//        Here the tile still showed the raw zero with no sentence at all.
//   251  "Opened 0" in success green. A zero in the color of good news says the
//        opposite of the sentence under it. Here both Opened and Clicked were
//        hard-coded to success whatever the number.
//   ---  "0% of delivered" while delivered is zero. The share was computed
//        against what went OUT and then labelled as a share of what LANDED.
//
// And the one found on the fixed copy, which is why this is a file rather than a
// paste: the sentence that replaced 246 promised confirmations "over the next
// few minutes" and had NO CLOCK in it, so it went on promising that for ever. It
// was read on a broadcast sent twenty days earlier. A sentence about what
// happens NEXT is a contract, and that one could not be kept.
//
// The two consoles may not import from each other, so this is a second copy on
// purpose, kept in step by hand.

/** `plain` is the colorless case, for a number that carries no verdict. */
export type Tone = 'plain' | 'info' | 'success' | 'warning' | 'error';

/** Only the two counts the Delivered tile reads. Declared here, structurally, so
 *  this module imports nothing — `BroadcastStats` satisfies it. */
export interface DeliveryCounts {
  accepted: number;
  delivered: number;
}

export interface Tile {
  value: number;
  hint: string;
  tone: Tone;
}

/**
 * How long a delivery confirmation is still plausibly on its way.
 *
 * Mail providers confirm minutes to hours after a send, so an hour is generous
 * on purpose. The exact figure is not the point — the point is that the
 * promise EXPIRES. Past it, "arriving over the next few minutes" is false, and
 * a screen that keeps saying it is telling someone to keep waiting for
 * something that is not coming.
 */
export const CONFIRMATION_WINDOW_MS = 60 * 60 * 1000;

/**
 * Is a delivery confirmation still reasonably expected?
 *
 * An unreadable or absent send time keeps the gentler sentence. Being vague is
 * survivable; announcing that the mail failed because a timestamp was missing is
 * not.
 */
export function confirmationStillExpected(sentAt: string | null, now: Date = new Date()): boolean {
  if (!sentAt) return true;
  const at = Date.parse(sentAt);
  if (Number.isNaN(at)) return true;
  return now.getTime() - at < CONFIRMATION_WINDOW_MS;
}

/** The Delivered tile's number, sentence and color. Four states, because
 *  "handed over, not yet confirmed" is neither "delivered" nor "failed" — and
 *  because it stops being "not YET" once enough time has gone by. */
export function deliveredTile(
  stats: DeliveryCounts,
  sentAt: string | null,
  now: Date = new Date()
): Tile {
  if (stats.delivered > 0) {
    return {
      value: stats.delivered,
      hint: 'Confirmed by the receiving mail server',
      tone: 'success',
    };
  }
  if (stats.accepted > 0) {
    if (confirmationStillExpected(sentAt, now)) {
      return {
        value: stats.accepted,
        hint: 'On their way. Confirmations arrive over the next few minutes.',
        tone: 'info',
      };
    }
    // Past the window and still nothing back. Say only that, because two very
    // different things look like this from here: a mail service that does not
    // report deliveries at all, and mail that genuinely did not land. Naming
    // either one would be a guess, and a guess here sends the reader off to fix
    // the wrong thing.
    return {
      value: stats.accepted,
      hint: 'These went out. Nothing has come back since to confirm they landed.',
      tone: 'plain',
    };
  }
  return { value: 0, hint: 'Nothing has gone out yet', tone: 'plain' };
}

/** Good news only once there is some. A zero in success green says the opposite
 *  of the sentence under it (issue 251). */
export function achievedTone(count: number): Tone {
  return count > 0 ? 'success' : 'plain';
}

/** "of delivered" is a lie while nothing is confirmed — the share is of what
 *  actually went out. */
export function shareOfLabel(delivered: number): string {
  return delivered > 0 ? 'of delivered' : 'of those sent';
}
