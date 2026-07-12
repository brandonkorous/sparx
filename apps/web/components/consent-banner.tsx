'use client';

// Marketing-site cookie consent (docs/42 §4.3 adapted for the platform site).
// GDPR opt-in: the banner shows until the visitor decides; PostHog (analytics) and
// the marketing click-id capture stay dark until then. After a decision a quiet
// "Cookie preferences" pill remains so consent can always be changed/withdrawn
// (also re-openable via a `sparx:open-consent` event from a footer link).
//
// Client-only — the `sparx_consent_state` cookie is the record (lib/consent.ts).
// Renders nothing until mounted to avoid an SSR flash / hydration mismatch.

import { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import { Button, Checkbox } from '@wizeworks/silicaui-react';
import {
  ALL_GRANTED,
  ESSENTIAL_ONLY,
  getConsent,
  setConsent,
  type ConsentCategory,
  type ConsentState,
} from '../lib/consent';

const OPEN_EVENT = 'sparx:open-consent';
const POLICY_HREF = '/legal/privacy';

type NonEssential = Exclude<ConsentCategory, 'strictly_necessary'>;

// Only the categories the marketing site actually gates on — analytics (PostHog)
// and marketing (ad click-ids in the attribution capture). `preferences` stays in
// the cookie shape for cross-property consistency but isn't offered here, since
// sparx.works has no preference cookie to gate.
const NON_ESSENTIAL: { key: NonEssential; label: string; copy: string }[] = [
  {
    key: 'analytics',
    label: 'Analytics',
    copy: 'Helps us understand how the site is used so we can improve it.',
  },
  {
    key: 'marketing',
    label: 'Marketing',
    copy: 'Lets us measure which campaigns bring people to sparx.',
  },
];

export function ConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [decided, setDecided] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentState>(ESSENTIAL_ONLY);

  useEffect(() => {
    setMounted(true);
    const current = getConsent();
    setDecided(current !== null);
    setBannerOpen(current === null);
    setDraft(current ?? ESSENTIAL_ONLY);
    const open = () => {
      setDraft(getConsent() ?? ESSENTIAL_ONLY);
      setPrefsOpen(true);
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  function record(state: ConsentState) {
    setConsent(state);
    setDecided(true);
    setBannerOpen(false);
    setPrefsOpen(false);
  }

  if (!mounted) return null;

  return (
    <>
      {bannerOpen && (
        <div
          className="mkt-consent-banner"
          role="dialog"
          aria-label="Cookie consent"
          aria-live="polite"
        >
          <div className="mkt-consent-banner__text">
            <strong>We value your privacy</strong>
            <p>
              We use cookies to run sparx.works and, with your consent, to understand traffic and
              measure our marketing. See our{' '}
              <a href={POLICY_HREF} className="mkt-consent-link">
                Privacy &amp; Cookie Policy
              </a>
              .
            </p>
          </div>
          <div className="mkt-consent-banner__actions">
            <Button variant="ghost" size="sm" onClick={() => setPrefsOpen(true)}>
              Manage
            </Button>
            <Button variant="outline" size="sm" onClick={() => record(ESSENTIAL_ONLY)}>
              Essential only
            </Button>
            <Button variant="solid" size="sm" onClick={() => record(ALL_GRANTED)}>
              Accept all
            </Button>
          </div>
        </div>
      )}

      {decided && !bannerOpen && !prefsOpen && (
        <button
          type="button"
          className="mkt-consent-pill"
          onClick={() => {
            setDraft(getConsent() ?? ESSENTIAL_ONLY);
            setPrefsOpen(true);
          }}
          aria-label="Cookie preferences"
        >
          <Cookie className="mkt-consent-pill__icon" size={15} aria-hidden />
          <span className="mkt-consent-pill__label">Cookie preferences</span>
        </button>
      )}

      {prefsOpen && (
        <div className="mkt-consent-overlay">
          <button
            type="button"
            className="mkt-consent-scrim"
            aria-label="Close cookie preferences"
            onClick={() => setPrefsOpen(false)}
          />
          <div
            className="mkt-consent-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Cookie preferences"
          >
            <h2 className="mkt-consent-modal__title">Cookie preferences</h2>
            <p className="mkt-consent-modal__lede">
              Choose which cookies to allow. See our{' '}
              <a href={POLICY_HREF} className="mkt-consent-link">
                Privacy &amp; Cookie Policy
              </a>{' '}
              for details.
            </p>

            <div className="mkt-consent-row mkt-consent-row--locked">
              <div className="mkt-consent-row__text">
                <strong>Strictly necessary</strong>
                <span>Required for the site to work. Always on.</span>
              </div>
              <Checkbox checked readOnly disabled aria-label="Strictly necessary (always on)" />
            </div>

            {NON_ESSENTIAL.map(({ key, label, copy }) => (
              <div key={key} className="mkt-consent-row">
                <div className="mkt-consent-row__text">
                  <strong>{label}</strong>
                  <span>{copy}</span>
                </div>
                <Checkbox
                  checked={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
                  aria-label={label}
                />
              </div>
            ))}

            <div className="mkt-consent-modal__actions">
              <Button variant="ghost" size="sm" onClick={() => record(ESSENTIAL_ONLY)}>
                Reject all
              </Button>
              <Button variant="solid" size="sm" onClick={() => record(draft)}>
                Save preferences
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
