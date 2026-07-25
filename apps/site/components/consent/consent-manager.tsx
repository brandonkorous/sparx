'use client';

// Cookie-consent island (docs/42 §4.3). Three server-decided states, fed the
// tenant's consent config so there's no client flash:
//   • mode 'off'                         → render nothing
//   • mode set, banner disabled          → quiet "Manage cookies" affordance
//   • mode set, banner enabled, undecided → the banner (GDPR opt-in / CCPA opt-out)
//
// The decision is persisted client-side (the /api/sparx proxy relays only one
// Set-Cookie, so the cookie is set here) and POSTed to /v1/public/consent for
// the legal record. Styled with silica classes + Tailwind utilities.

import { useEffect, useState } from 'react';
import type { SiteConsent } from '@/lib/site-context';
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

export function ConsentManager({ tenant, config }: { tenant: string; config: SiteConsent }) {
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
        <div
          className="rounded-box border-base-300 bg-base-100 fixed inset-x-4 bottom-4 z-[80] mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 border p-4"
          role="dialog"
          aria-label="Cookie consent"
        >
          <div className="[&_a]:text-primary [&_p]:text-base-content [&_strong]:text-base-content min-w-0 flex-1 basis-[22rem] [&_a]:underline [&_p]:m-0 [&_p]:text-sm [&_strong]:mb-1 [&_strong]:block">
            <strong>{config.bannerTitle ?? 'We value your privacy'}</strong>
            <p>
              {config.bannerBody ??
                'We use cookies to run this site and, with your consent, to improve it.'}{' '}
              See our <a href={policyHref}>Cookie Policy</a>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.mode === 'ccpa' ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    record({ ...draft, analytics: false, marketing: false }, 'opt_out')
                  }
                >
                  Do Not Sell or Share My Info
                </button>
                <button
                  type="button"
                  className="btn btn-neutral btn-outline btn-sm"
                  onClick={() => record(ALL_ON, 'accept_all')}
                >
                  Got it
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-neutral btn-outline btn-sm"
                  onClick={() => record(NONE, 'reject_all')}
                >
                  Reject all
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => record(ALL_ON, 'accept_all')}
                >
                  Accept all
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
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
          className="rounded-selector border-base-300 bg-base-100 text-base-content fixed bottom-4 left-4 z-[70] cursor-pointer border px-3 py-1.5 text-[0.8125rem] opacity-85 transition-opacity hover:opacity-100"
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
            aria-label="Close cookie preferences"
            onClick={() => setPrefsOpen(false)}
          />
          <div
            className="rounded-box border-base-300 bg-base-100 relative z-[1] max-h-[85vh] w-full max-w-[30rem] overflow-y-auto border p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Cookie preferences"
          >
            <h2 className="text-base-content mb-2 text-lg font-semibold">Cookie preferences</h2>
            <p className="text-base-content [&_a]:text-primary mb-4 text-sm [&_a]:underline">
              Choose which cookies to allow. See our <a href={policyHref}>Cookie Policy</a> for
              details.
            </p>

            <div className="border-base-300 [&_span]:text-base-content [&_strong]:text-base-content flex items-start justify-between gap-4 border-t py-3 opacity-70 [&_span]:block [&_span]:text-[0.8125rem] [&_strong]:block [&_strong]:text-[0.9rem]">
              <div>
                <strong>Strictly necessary</strong>
                <span>Required for the site to work. Always on.</span>
              </div>
              <input type="checkbox" checked readOnly disabled aria-label="Strictly necessary" />
            </div>

            {nonEssential.map((cat) => (
              <label
                key={cat}
                className="border-base-300 [&_span]:text-base-content [&_strong]:text-base-content flex items-start justify-between gap-4 border-t py-3 [&_span]:block [&_span]:text-[0.8125rem] [&_strong]:block [&_strong]:text-[0.9rem]"
              >
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

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => record(NONE, 'reject_all')}
              >
                Reject all
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
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
