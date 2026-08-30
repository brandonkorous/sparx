'use client';

// Has this tab already reloaded trying to reach that business?
//
// Switching site to honour a link means a reload, and a reload that lands
// somewhere it still cannot open would switch and reload again. The guard is
// per-tab (sessionStorage) and per-site, so one bad link cannot loop the tab.

const SWITCH_ATTEMPT_KEY = 'sparx-workbench-link-switch';

/** Every site this tab has already reloaded trying to reach. */
function readSwitchAttempts(): string[] {
  try {
    const raw = sessionStorage.getItem(SWITCH_ATTEMPT_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    // A single id is what the previous shape wrote — read it so a tab already
    // open across the upgrade keeps its guard rather than losing it.
    if (typeof parsed === 'string') return [parsed];
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    // Blocked storage, or a value that predates JSON (the bare site id). Either
    // way there is nothing we can trust, and the caller treats an empty list as
    // "not attempted" — which is safe only because noteSwitchAttempt refuses to
    // switch at all when it cannot write.
    return [];
  }
}

/**
 * Remembers that we already reloaded once trying to reach this site.
 *
 * Switching workspaces is a cookie write plus a reload, and api-rest re-resolves
 * that cookie under RLS and FAILS CLOSED to the tenant's primary site. So a link
 * naming a site the session cannot actually hold would switch, come back on the
 * primary, see the mismatch, and switch again — a reload loop with no way out
 * except closing the tab. One attempt per site is allowed; the second time the
 * same site is asked for, the link is reported unreachable instead.
 *
 * A SET, not the last id. Remembering only the most recent attempt reads every
 * A → B → A alternation as three first attempts and never fires, which is
 * exactly the loop that shipped: two businesses trading the tab back and forth
 * roughly once a second until api-rest rate-limited it. What makes a loop a loop
 * is revisiting a state, so the guard has to remember every state visited.
 *
 * sessionStorage rather than memory, because the reload is precisely what
 * destroys memory. Per-tab, so another tab's attempt never suppresses this one's.
 */
export function noteSwitchAttempt(siteId: string): boolean {
  try {
    const attempts = readSwitchAttempts();
    if (!attempts.includes(siteId)) attempts.push(siteId);
    sessionStorage.setItem(SWITCH_ATTEMPT_KEY, JSON.stringify(attempts));
    return true;
  } catch {
    // Storage blocked, so there is nowhere to record that we tried — and the
    // reload is about to destroy memory. WE MUST NOT SWITCH: an unrecorded
    // attempt is an attempt that repeats forever, because the next load has no
    // way to know it already happened. Reporting the link as unreachable is a
    // dead end for one link; switching without a guard is a dead end for the
    // whole tab. Fail safe, not eager.
    return false;
  }
}

export function switchAlreadyAttempted(siteId: string): boolean {
  return readSwitchAttempts().includes(siteId);
}

/**
 * Clears the guard once we have actually landed on the site the link named.
 *
 * ONLY once the SITE gate has passed. Clearing it when the guard has just FIRED —
 * when the answer was "that site is unreachable" — disarms the one thing standing
 * between a failed switch and an infinite reload loop: the next document load
 * would try the same switch again, fail the same way, clear the guard again.
 * That is not hypothetical; it shipped, and it alternated the address bar
 * between the link and the unresolved pane until the tab was closed.
 *
 * Passing the site gate is the whole test, though — NOT opening a pane. A link
 * that reaches the right business and is then refused by the module gate has
 * still proved the switch worked, so leaving the attempt on the record would
 * strand the tab: a second link to that same business, minutes later, would be
 * reported unreachable when nothing about it is.
 */
export function clearSwitchAttempt(): void {
  try {
    sessionStorage.removeItem(SWITCH_ATTEMPT_KEY);
  } catch {
    // See above.
  }
}
