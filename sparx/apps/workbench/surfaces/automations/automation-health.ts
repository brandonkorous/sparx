// IS THE RULE ACTUALLY WORKING? Not just: is it switched on?
//
// The Status column read the stored `status` word and nothing else, so a rule
// whose every run had failed said "On", in success green. Measured 2026-09-16
// on one shop's screen:
//
//     Invoice overdue (7 days)      8 failed, 8 succeeded    On
//     Return approved: email        4 failed, 0 succeeded    On
//     Order refunded: email         2 failed, 0 succeeded    On
//
// Three of her rules had never once worked. The customer who was promised a
// confirmation when her return was approved never got one, four times over, and
// the one screen that could have told her said everything was fine.
//
// There IS an `error` status, and a "Needs attention" badge already shipped for
// it. Nothing sets it. The engine's own comment says why: "A single failed run
// does NOT flip the automation's own status to `error` — that
// pause-on-repeated-failure policy is a later (UI) slice." It never landed, so
// the badge waits over a state nothing produces, and every automation on the
// platform is `active`, `paused` or `draft`. Zero are `error`.
//
// So this does not add a SIXTH stored word for another table to make stale. The
// counters are already on the row and already on the screen beside the badge —
// `runCount` (successes) and `errorCount` (failures). The rule reads them.
//
// A leaf module, importing nothing, so the sentences can be tested.

export type HealthTone = 'success' | 'warning' | 'error' | 'neutral';

export interface Health {
  label: string;
  tone: HealthTone;
  /** For a list, where she is OUTSIDE the rule and has to be sent into it. */
  detail: string;
  /**
   * For the rule's own screen, where she is already inside it.
   *
   * The list's sentence ends "Open it to see which", which on the rule itself is
   * an instruction to do the thing she has just done. This one names the
   * CONSEQUENCE instead, because the screen that carries it also carries a
   * button to the failures and the sentence should not argue with the button.
   * [[feedback_one_outcome_two_causes]]
   */
  inside: string;
}

/**
 * `runCount` counts runs that COMPLETED; `errorCount` counts runs that failed.
 * They are separate counters, so attempts are the two added together, and a rule
 * with `runCount: 0, errorCount: 2` has been triggered twice and has never once
 * done what it says.
 *
 * Only an `active` rule can be failing. A paused or draft rule is not trying, so
 * its old failures are history rather than a thing happening now.
 */
export function automationHealth(
  status: string,
  runCount: number,
  errorCount: number
): Health | null {
  if (status !== 'active' || errorCount <= 0) return null;
  const attempts = runCount + errorCount;
  if (runCount === 0) {
    const tried =
      attempts === 1
        ? 'It has been set off once and failed.'
        : `It has been set off ${String(attempts)} times and failed every time.`;
    return {
      label: 'Not working',
      tone: 'error',
      detail: `${tried} Nothing it promises has happened yet. Open it to see what stopped it.`,
      inside: `${tried} Nothing it promises has happened yet.`,
    };
  }
  return {
    label: 'Some failures',
    tone: 'warning',
    detail: `${String(errorCount)} of its ${String(attempts)} attempts failed. Open it to see which.`,
    inside: `${String(errorCount)} of its ${String(attempts)} attempts failed, so some of what it promises did not happen.`,
  };
}

/**
 * THE LAST TIME THIS RULE WAS SET OFF, whether or not it worked.
 *
 * `lastRunAt` records the last run that COMPLETED; a failed run writes
 * `lastErrorAt` instead. The column only ever read the first, so a rule that had
 * been triggered twice and failed both times read "Not run yet", three
 * characters from its own red failure count. It had run. It just had not worked.
 *
 * `lastErrorAt` was already on the row and already fetched by the list; nothing
 * drew it.
 */
export function lastAttempt(
  lastRunAt: string | null,
  lastErrorAt: string | null
): { at: string; failed: boolean } | null {
  if (lastRunAt === null && lastErrorAt === null) return null;
  if (lastErrorAt === null) return { at: lastRunAt ?? '', failed: false };
  if (lastRunAt === null) return { at: lastErrorAt, failed: true };
  const failedLast = Date.parse(lastErrorAt) > Date.parse(lastRunAt);
  return { at: failedLast ? lastErrorAt : lastRunAt, failed: failedLast };
}
