'use client';

// What meetpiggles.com is allowed to remember about a visit — the record, and
// the one seam everything non-essential goes through.
//
// ── WHY THIS EXISTS NOW WHEN IT DID NOT BEFORE ──────────────────────────────
//
// The marketing site used to set nothing at all, and the cookie policy said so
// in as many words. That was honest and it cost real money: a visitor arriving
// from a paid campaign carried `utm_campaign=spring&gclid=…` in the URL, and
// none of it survived the click through to signup. Every customer looked like
// they had simply appeared. Attribution cannot be reconstructed later — the
// campaign is over, the URL is gone — so "measure it once we are bigger" is not
// an option that exists.
//
// So the site now remembers where somebody came from, and because that is
// exactly the kind of thing people are entitled to refuse, it asks first.
//
// ── OPT-IN, AND NOTHING BEFORE THE ANSWER ───────────────────────────────────
//
// Nothing non-essential runs until the visitor accepts. Not "runs until they
// decline" — until they ACCEPT. A visitor who ignores the bar is a visitor who
// has not agreed, and the capture stays off for them permanently. The decision
// itself IS this cookie; there is no account yet to hang it on, which is the
// whole difference between this and the console's account-level record.
//
// ── WHY THE CONSOLE'S ARGUMENT DOES NOT APPLY HERE ──────────────────────────
//
// The console deliberately has no consent bar: its argument is that somebody who
// has just reached their own business should not be asked to deal with
// housekeeping first, and that the question belongs on the domain where they
// deal with WizeWorks. Both halves of that are about a CUSTOMER. A visitor to
// meetpiggles.com has no account, no business and nowhere else to be asked — so
// the bar is the only place the question can be put, and there is no work behind
// it to interrupt.

export type ConsentCategory = 'strictly_necessary' | 'analytics' | 'marketing';

export interface ConsentState {
  strictly_necessary: true;
  /** Where a visitor came from — the UTM/referrer capture. */
  analytics: boolean;
  /** Advertising click ids (gclid, fbclid and the rest), which identify a
   *  specific ad click and so are asked for separately. */
  marketing: boolean;
}

const STATE_COOKIE = 'piggles_consent_state';
const ONE_YEAR = 31_536_000;
const CONSENT_EVENT = 'piggles:consent';

export const ALL_GRANTED: ConsentState = {
  strictly_necessary: true,
  analytics: true,
  marketing: true,
};

export const ESSENTIAL_ONLY: ConsentState = {
  strictly_necessary: true,
  analytics: false,
  marketing: false,
};

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** `.meetpiggles.com` so the decision holds across the marketing site; host-only
 *  on localhost and previews. It deliberately does NOT reach getpiggles.com or
 *  mypiggles.com — those are separate registrable domains and could not share it
 *  anyway, which is the same fact that makes the auth handoff exist. */
function cookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname;
  return host === 'meetpiggles.com' || host.endsWith('.meetpiggles.com')
    ? '.meetpiggles.com'
    : undefined;
}

/** The recorded decision, or null when nobody has answered yet. Three states,
 *  and `null` must never collapse into "declined" — one is a decision to respect
 *  and the other is a question still to ask. */
export function getConsent(): ConsentState | null {
  const raw = readCookie(STATE_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    return {
      strictly_necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
    };
  } catch {
    // A malformed record is not an answer. Re-asking costs a bar; assuming a
    // grant costs the thing consent is for.
    return null;
  }
}

export function hasDecided(): boolean {
  return getConsent() !== null;
}

/** Persist a decision and tell anything waiting on it. The cookie is the record
 *  — there is no server round trip, because there is no account to write to. */
export function setConsent(state: ConsentState): void {
  if (typeof document === 'undefined') return;
  const value = encodeURIComponent(
    JSON.stringify({ analytics: state.analytics, marketing: state.marketing })
  );
  const domain = cookieDomain();
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie =
    `${STATE_COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax` +
    (domain ? `; domain=${domain}` : '') +
    secure;
  window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_EVENT, { detail: state }));
}

export function onConsentChange(callback: (state: ConsentState) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    callback((event as CustomEvent<ConsentState>).detail);
  };
  window.addEventListener(CONSENT_EVENT, handler);
  return () => {
    window.removeEventListener(CONSENT_EVENT, handler);
  };
}

/**
 * Register something that may only run with permission.
 *
 * Runs `load` immediately if the category is already granted, otherwise the
 * moment it is granted, and never otherwise. The single seam — anything that
 * reaches for `document.cookie` on this site without going through here is a
 * bug, and the cookie policy is written on the assumption that none exists.
 */
export function gateTracker({
  category,
  load,
}: {
  category: ConsentCategory;
  load: () => void;
}): () => void {
  let loaded = false;
  const run = (state: ConsentState | null) => {
    if (loaded) return;
    if (category === 'strictly_necessary' || state?.[category]) {
      loaded = true;
      load();
    }
  };
  run(getConsent());
  if (loaded) return () => undefined;
  return onConsentChange(run);
}
