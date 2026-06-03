'use client';

// Cookie-consent island (docs/42 §4.3). Three server-decided states, fed the
// tenant's consent config so there's no client flash:
//   • mode 'off'                         → render nothing
//   • mode set, banner disabled          → quiet "Manage cookies" affordance
//   • mode set, banner enabled, undecided → the banner (GDPR opt-in / CCPA opt-out)
//
// The decision is persisted client-side (the /api/sparx proxy relays only one
// Set-Cookie, so the cookie is set here) and POSTed to /v1/public/consent for
// the legal record. Built from sf-consent-* classes in site.css.

import { useEffect, useState } from 'react';
import type { TenantConsent } from '@/lib/tenant';
import {
  getConsent,
  getVisitorId,
  setConsent,
  type ConsentCategory,
  type ConsentState,
} from '@/lib/consent';

const OPENERS = 'sparx:open-consent';

const CATEGORY_COPY: Record<Exclude<ConsentCategory, 'strictly_necessary'>, string> = {
  preferences: 'Remember choices like language and light/dark mode.',
  analytics: 'Help us understand how the site is used so we can improve it.',
  marketing: 'Used to deliver and measure relevant offers.',
};

const ALL_ON: ConsentState = {
  strictly_necessary: true,
  preferences: true,
  analytics: true,
  marketing: true,
};
const NONE: ConsentState = {
  strictly_necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
};

export function ConsentManager({ tenant, config }: { tenant: string; config: TenantConsent }) {
  const [bannerOpen, setBannerOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentState>(NONE);

  useEffect(() => {
    const current = getConsent();
    // CCPA defaults non-essential categories ON (opt-out model); GDPR off.
    setDraft(current ?? (config.mode === 'ccpa' ? ALL_ON : NONE));
    setBannerOpen(config.bannerEnabled && current === null);
    const open = () => setPrefsOpen(true);
    window.addEventListener(OPENERS, open);
    return () => window.removeEventListener(OPENERS, open);
  }, [config.bannerEnabled, config.mode]);

  if (config.mode === 'off') return null;

  async function record(state: ConsentState, action: string) {
    setConsent(state);
    setBannerOpen(false);
    setPrefsOpen(false);
    try {
      await fetch(`/api/sparx/v1/public/consent?tenant=${encodeURIComponent(tenant)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visitorId: getVisitorId(), categories: state, action }),
      });
    } catch {
      // The client-side cookie is the source of gating truth; a failed record
      // POST shouldn't block the visitor. It will re-POST on the next decision.
    }
  }

  const policyHref = `/${config.policyPageSlug}`;
  const nonEssential: Exclude<ConsentCategory, 'strictly_necessary'>[] = [
    'preferences',
    'analytics',
    'marketing',
  ];

  return (
    <>
      {bannerOpen ? (
        <div className="sf-consent-banner" role="dialog" aria-label="Cookie consent">
          <div className="sf-consent-banner__text">
            <strong>{config.bannerTitle ?? 'We value your privacy'}</strong>
            <p>
              {config.bannerBody ??
                'We use cookies to run this site and, with your consent, to improve it.'}{' '}
              See our <a href={policyHref}>Cookie Policy</a>.
            </p>
          </div>
          <div className="sf-consent-banner__actions">
            {config.mode === 'ccpa' ? (
              <>
                <button
                  type="button"
                  className="sf-consent-btn sf-consent-btn--primary"
                  onClick={() =>
                    record({ ...draft, analytics: false, marketing: false }, 'opt_out')
                  }
                >
                  Do Not Sell or Share My Info
                </button>
                <button
                  type="button"
                  className="sf-consent-btn"
                  onClick={() => record(ALL_ON, 'accept_all')}
                >
                  Got it
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="sf-consent-btn"
                  onClick={() => record(NONE, 'reject_all')}
                >
                  Reject all
                </button>
                <button
                  type="button"
                  className="sf-consent-btn sf-consent-btn--primary"
                  onClick={() => record(ALL_ON, 'accept_all')}
                >
                  Accept all
                </button>
              </>
            )}
            <button
              type="button"
              className="sf-consent-btn sf-consent-btn--ghost"
              onClick={() => setPrefsOpen(true)}
            >
              Manage
            </button>
          </div>
        </div>
      ) : (
        // Persistent affordance. In CCPA mode this is the required, clearly
        // labeled "Do Not Sell or Share" control; otherwise a quiet "Manage
        // cookies" link. Both open the preference center.
        <button
          type="button"
          className="sf-consent-pill"
          onClick={() => setPrefsOpen(true)}
          aria-label={
            config.mode === 'ccpa'
              ? 'Do Not Sell or Share My Personal Information'
              : 'Manage cookie preferences'
          }
        >
          {config.mode === 'ccpa' ? 'Do Not Sell or Share My Info' : 'Manage cookies'}
        </button>
      )}

      {prefsOpen ? (
        <div className="sf-consent-modal__overlay">
          <button
            type="button"
            className="sf-consent-modal__scrim"
            aria-label="Close cookie preferences"
            onClick={() => setPrefsOpen(false)}
          />
          <div
            className="sf-consent-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Cookie preferences"
          >
            <h2 className="sf-consent-modal__title">Cookie preferences</h2>
            <p className="sf-consent-modal__lede">
              Choose which cookies to allow. See our <a href={policyHref}>Cookie Policy</a> for
              details.
            </p>

            <div className="sf-consent-row sf-consent-row--locked">
              <div>
                <strong>Strictly necessary</strong>
                <span>Required for the site to work. Always on.</span>
              </div>
              <input type="checkbox" checked readOnly disabled aria-label="Strictly necessary" />
            </div>

            {nonEssential.map((cat) => (
              <label key={cat} className="sf-consent-row">
                <div>
                  <strong>{cat.charAt(0).toUpperCase() + cat.slice(1)}</strong>
                  <span>{CATEGORY_COPY[cat]}</span>
                </div>
                <input
                  type="checkbox"
                  checked={draft[cat]}
                  onChange={(e) => setDraft((d) => ({ ...d, [cat]: e.target.checked }))}
                  aria-label={cat}
                />
              </label>
            ))}

            <div className="sf-consent-modal__actions">
              <button
                type="button"
                className="sf-consent-btn sf-consent-btn--ghost"
                onClick={() => record(NONE, 'reject_all')}
              >
                Reject all
              </button>
              <button
                type="button"
                className="sf-consent-btn sf-consent-btn--primary"
                onClick={() => record(draft, 'save_prefs')}
              >
                Save preferences
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
