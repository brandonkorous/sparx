'use client';

// Turning a failed write into a sentence a business owner can act on.
//
// The people using this run a shop, a clinic, a workshop. "422 Unprocessable
// Entity", "NetworkError when attempting to fetch resource" and "RATE_LIMITED"
// are all true and all useless: none of them says whether the thing they typed
// still exists, whether it is their fault, or what to do next. Those three are
// the whole content of a good failure message, and this module is the one place
// that decides them.
//
// The order of the checks is the order of BLAME, not the order of the status
// codes. Offline first, because the commonest failure is not our fault and not
// theirs and needs no apology — just "you're offline". Then the ones they can
// fix. Then ours, which gets a plain admission rather than a euphemism.

import { ApiError } from '@sparx/api-client';

export interface WriteFailure {
  /** The sentence shown to the operator. Complete, jargon-free, actionable. */
  readonly message: string;
  /**
   * api-rest's request id, when the failure came back through the envelope.
   * Shown to the operator ONLY for the failures they cannot act on — see
   * `showReference`. It is the one string that ties what they saw to the server
   * log line, which is the difference between "it broke sometimes" and a fix.
   */
  readonly reference?: string;
  /**
   * Whether to put the reference in front of them. True only when the answer is
   * "this is on us" — the person cannot use it for anything else, and printing a
   * hex id under "you're offline" turns an ordinary hiccup into something that
   * looks like it needs reporting.
   */
  readonly showReference: boolean;
  /** For telemetry, never rendered. */
  readonly code: string;
}

/**
 * True when the browser says we are offline, or the request never reached a
 * server at all. `fetch` rejects with a bare TypeError for DNS failures, refused
 * connections, and a dropped Wi-Fi link alike — indistinguishable from each
 * other and, for the operator, all the same event.
 */
function isOffline(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return error instanceof TypeError;
}

export function describeWriteFailure(error: unknown): WriteFailure {
  if (isOffline(error)) {
    return {
      message:
        "You're not connected to the internet, so that didn't save. Check your connection and try again — what you typed is still here.",
      showReference: false,
      code: 'offline',
    };
  }

  if (!(error instanceof ApiError)) {
    return {
      message: "Something went wrong and that didn't save. Please try again.",
      showReference: false,
      code: 'unknown',
    };
  }

  const reference = error.requestId;

  // 401/403 — the session ended, or this person genuinely may not do this. Kept
  // separate because the fixes are opposite: one is "sign in again", the other
  // is "ask whoever runs your account". Guessing wrong sends them to the wrong
  // person, so each says only what it knows.
  if (error.status === 401) {
    return {
      message:
        "You've been signed out, so that didn't save. Sign in again and your work is still here.",
      showReference: false,
      code: 'signed-out',
    };
  }
  if (error.status === 403) {
    return {
      message:
        "You don't have permission to do that, so nothing was changed. Whoever manages your account can give you access.",
      showReference: false,
      code: 'forbidden',
    };
  }

  if (error.status === 404) {
    return {
      message:
        'That no longer exists — someone may have deleted it while you had it open. Nothing was changed.',
      showReference: false,
      code: 'gone',
    };
  }

  // 409 — someone else got there first. The one failure where "try again" is
  // actively wrong advice: retrying would overwrite whatever they did.
  if (error.status === 409) {
    return {
      message:
        'Someone else changed this while you had it open, so it was not saved over. Reopen it to see their version, then make your change again.',
      showReference: false,
      code: 'conflict',
    };
  }

  if (error.status === 429) {
    return {
      message: 'That was a lot of changes at once. Wait a moment and try again.',
      showReference: false,
      code: 'rate-limited',
    };
  }

  // 400/422 and friends — the server is telling them what is wrong with what
  // they entered, and it is written for them (docs/06 §3). Passing it through is
  // the whole point: "Choose a delivery date that isn't in the past" beats any
  // generic sentence we could substitute.
  if (error.status >= 400 && error.status < 500) {
    return {
      message: error.message || "That didn't save. Check what you entered and try again.",
      showReference: false,
      code: error.code || 'rejected',
    };
  }

  // 5xx — ours. Say so plainly: an owner who thinks they broke it goes hunting
  // through their own data for a mistake that was never there.
  return {
    message:
      "Something went wrong on our end, so that didn't save. Nothing you typed was lost — try again in a moment.",
    reference,
    showReference: Boolean(reference),
    code: error.code || 'server-error',
  };
}
