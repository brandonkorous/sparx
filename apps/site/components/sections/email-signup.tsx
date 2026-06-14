'use client';

// Email signup section — inline newsletter capture form. Client island so the
// submit + success state work without a page navigation.
//
// NOTE: there is no public newsletter-subscribe endpoint yet (CRM contact
// capture is a separate module concern), so submit currently validates the
// address and shows the configured success message client-side. Wiring the
// POST to a capture endpoint is tracked as a storefront follow-up.

import { useState } from 'react';

import type { EmailSignupConfig } from '@sparx/sitebuilder-schemas';

export function EmailSignupSection({ config }: { config: EmailSignupConfig }) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) return;
    setDone(true);
  }

  return (
    <section className="st-container st-section">
      <div className="st-sb-signup">
        {config.heading ? <h2 className="st-h2">{config.heading}</h2> : null}
        {config.description ? <p className="st-muted">{config.description}</p> : null}
        {done ? (
          <p className="st-sb-signup__ok" role="status">
            {config.successMessage}
          </p>
        ) : (
          <form className="st-sb-signup__form" onSubmit={onSubmit}>
            <label className="st-skip-link" htmlFor="st-newsletter-email">
              Email address
            </label>
            <input
              id="st-newsletter-email"
              type="email"
              className="st-input"
              placeholder={config.placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="st-btn st-btn--primary">
              {config.buttonLabel}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
