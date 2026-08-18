// Storefront cookie-consent client contract (docs/42 §4.4).
//
// The single seam every tracker uses. A future analytics/marketing integration
// calls `gateTracker({ category, load })` — `load` runs immediately if the
// category is already granted, otherwise once the visitor grants it. Nothing
// fires pre-consent. Today there are no trackers, so this is the forward hook
// plus the helpers the consent island uses to read/write the decision.
//
// Two cookies, both client-set (the /api/sparx proxy relays only one
// Set-Cookie, so the API records the decision but never sets the cookie):
//   sparx_consent        — visitor id (uuid), strictly-necessary
//   sparx_consent_state  — the decision, readable so SSR/first-paint can gate

'use client';

export type ConsentCategory = 'strictly_necessary' | 'preferences' | 'analytics' | 'marketing';

export const CONSENT_CATEGORIES: ConsentCategory[] = [
  'strictly_necessary',
  'preferences',
  'analytics',
  'marketing',
];

export type ConsentState = Record<ConsentCategory, boolean>;

const VISITOR_COOKIE = 'sparx_consent';
const STATE_COOKIE = 'sparx_consent_state';
const ONE_YEAR = 31_536_000;
export const CONSENT_EVENT = 'sparx:consent';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(document.cookie);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/** Stable per-visitor id, minted + persisted on first need (strictly-necessary). */
export function getVisitorId(): string {
  const existing = readCookie(VISITOR_COOKIE);
  if (existing) return existing;
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  writeCookie(VISITOR_COOKIE, id);
  return id;
}

/** The recorded decision, or null if the visitor hasn't decided yet. */
export function getConsent(): ConsentState | null {
  const raw = readCookie(STATE_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    return {
      strictly_necessary: true,
      preferences: Boolean(parsed.preferences),
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
    };
  } catch {
    return null;
  }
}

/** True once the visitor has made any consent decision. */
export function hasDecided(): boolean {
  return getConsent() !== null;
}

/** Persist a decision client-side + broadcast it so gated trackers and the
 *  banner react. Caller is responsible for also POSTing to the API for the
 *  legal record. */
export function setConsent(state: ConsentState): void {
  writeCookie(
    STATE_COOKIE,
    JSON.stringify({
      preferences: state.preferences,
      analytics: state.analytics,
      marketing: state.marketing,
    })
  );
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-consent', grantedList(state).join(' '));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_EVENT, { detail: state }));
  }
}

function grantedList(state: ConsentState): ConsentCategory[] {
  return CONSENT_CATEGORIES.filter((c) => c === 'strictly_necessary' || state[c]);
}

/** Subscribe to consent changes. Returns an unsubscribe fn. */
export function onConsentChange(cb: (state: ConsentState) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (e: Event) => cb((e as CustomEvent<ConsentState>).detail);
  window.addEventListener(CONSENT_EVENT, handler);
  return () => window.removeEventListener(CONSENT_EVENT, handler);
}

/** Register a tracker under a consent category. Runs `load` now if already
 *  granted, otherwise once on grant. The single seam for future analytics /
 *  marketing integrations — nothing fires pre-consent. */
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
