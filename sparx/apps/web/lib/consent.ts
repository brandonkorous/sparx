// Platform (marketing-site) cookie-consent contract.
//
// The site has its own tenant-scoped consent system (wizeworks/apps/site/lib/consent.ts
// + a ConsentRecord table FK'd to a tenant). The marketing site has no tenant, so
// this is a deliberately lighter, CLIENT-ONLY variant: the `sparx_consent_state`
// cookie IS the record. It shares the site's cookie name + JSON shape so the
// value is consistent across sparx-owned properties, and the cookie is scoped to
// `.sparx.works` (prod) so app.sparx.works sees the same decision the attribution
// capture reads (docs/80 §5.5, docs/42 §4.4).
//
// GDPR opt-in only: nothing non-essential fires until the visitor accepts. PostHog
// (analytics) and the marketing click-id capture both gate on this via gateTracker.

'use client';

export type ConsentCategory = 'strictly_necessary' | 'preferences' | 'analytics' | 'marketing';

export const CONSENT_CATEGORIES: ConsentCategory[] = [
  'strictly_necessary',
  'preferences',
  'analytics',
  'marketing',
];

export type ConsentState = Record<ConsentCategory, boolean>;

const STATE_COOKIE = 'sparx_consent_state';
const ONE_YEAR = 31_536_000;
export const CONSENT_EVENT = 'sparx:consent';

export const ALL_GRANTED: ConsentState = {
  strictly_necessary: true,
  preferences: true,
  analytics: true,
  marketing: true,
};
export const ESSENTIAL_ONLY: ConsentState = {
  strictly_necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
};

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(document.cookie);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

/** `.sparx.works` in prod so the decision is shared with app.sparx.works and the
 *  attribution capture; host-only on localhost / preview. Mirrors the domain logic
 *  in components/attribution-capture.tsx so the two stay in lockstep. */
function cookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname;
  return host === 'sparx.works' || host.endsWith('.sparx.works') ? '.sparx.works' : undefined;
}

function writeStateCookie(state: ConsentState): void {
  if (typeof document === 'undefined') return;
  const value = encodeURIComponent(
    JSON.stringify({
      preferences: state.preferences,
      analytics: state.analytics,
      marketing: state.marketing,
    })
  );
  const domain = cookieDomain();
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie =
    `${STATE_COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax` +
    (domain ? `; domain=${domain}` : '') +
    secure;
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

/** Persist a decision client-side + broadcast it so gated trackers and the banner
 *  react immediately. No server round-trip — the cookie is the record. */
export function setConsent(state: ConsentState): void {
  writeStateCookie(state);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_EVENT, { detail: state }));
  }
}

/** Subscribe to consent changes. Returns an unsubscribe fn. */
export function onConsentChange(cb: (state: ConsentState) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (e: Event) => cb((e as CustomEvent<ConsentState>).detail);
  window.addEventListener(CONSENT_EVENT, handler);
  return () => window.removeEventListener(CONSENT_EVENT, handler);
}

/** Register a tracker under a consent category. Runs `load` now if already granted,
 *  otherwise once on grant. The single seam every non-essential tracker uses —
 *  nothing fires pre-consent. Returns an unsubscribe fn. */
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
