'use client';

// Email signup section — inline newsletter capture form. Client island so the
// submit + success state work without a page navigation.
//
// NOTE: there is no public newsletter-subscribe endpoint yet (CRM contact
// capture is a separate module concern), so submit currently validates the
// address and shows the configured success message client-side. Wiring the
// POST to a capture endpoint is tracked as a storefront follow-up.

import { useState } from 'react';

import { Button, Input } from '@wizeworks/silicaui-react';
import type { EmailSignupConfig } from '@wizeworks/sitebuilder-schemas';

export function EmailSignupSection({ config }: { config: EmailSignupConfig }) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) return;
    setDone(true);
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="rounded-box bg-base-200 grid justify-items-center gap-[0.85rem] p-[clamp(2rem,5vw,3.5rem)] text-center">
        {config.heading ? (
          <h2 className="text-base-content text-3xl font-semibold tracking-tight">
            {config.heading}
          </h2>
        ) : null}
        {config.description ? <p className="text-base-content">{config.description}</p> : null}
        {done ? (
          <p className="text-primary font-semibold" role="status">
            {config.successMessage}
          </p>
        ) : (
          <form
            className="mt-2 flex w-[min(100%,460px)] flex-wrap justify-center gap-2"
            onSubmit={onSubmit}
          >
            <label className="sr-only" htmlFor="newsletter-email">
              Email address
            </label>
            <Input
              className="flex-[1_1_220px]"
              id="newsletter-email"
              type="email"
              placeholder={config.placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" color="primary">
              {config.buttonLabel}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
