'use client';

// Newsletter signup island — the interactive half of the Builder "Email signup"
// block (docs/51 §7). Renders the shared presentational <Signup> from site-ui
// (identical markup to the editor canvas) and owns the submit lifecycle: it POSTs
// the email to the public capture endpoint, then swaps the form for a thank-you.
// Tenant + active site come from the customer context the layout already mounts.

import { useState } from 'react';

import { Signup } from '@sparx/site-ui';

import { useCustomer } from '@/components/customer-provider';
import { subscribeEmail } from '@/lib/signup-client';

export function SignupForm({ cta }: { cta?: string }) {
  const { tenantSlug, propertySlug } = useCustomer();
  const [status, setStatus] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'pending') return;
    const raw = new FormData(e.currentTarget).get('email');
    const email = (typeof raw === 'string' ? raw : '').trim();
    if (!email.includes('@')) {
      setStatus('error');
      setError('Enter a valid email address.');
      return;
    }
    setStatus('pending');
    setError(null);
    try {
      await subscribeEmail(tenantSlug, email, propertySlug);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Signup
      cta={cta}
      onSubmit={onSubmit}
      pending={status === 'pending'}
      done={status === 'done'}
      error={status === 'error'}
      message={status === 'error' ? (error ?? undefined) : undefined}
    />
  );
}
