'use client';

// Newsletter signup island — the interactive half of the Builder "Email signup"
// block (docs/51 §7). Renders the shared presentational <Signup> from site-ui
// (identical markup to the static preview) and owns the submit lifecycle: it
// validates the email, calls the Builder runtime's capture effect, then swaps the
// form for a thank-you.
//
// The capture effect is injected (runtime-context.tsx): live posts to the public
// signup endpoint with the active tenant/site; the editor canvas no-ops it — so
// the SAME form renders + validates in the canvas without capturing a contact.

import { useState } from 'react';

import { Signup } from '@sparx/site-ui';

import { useBuilderRuntime } from './runtime-context';

export function SignupForm({ cta }: { cta?: string }) {
  const { subscribeEmail } = useBuilderRuntime();
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
      await subscribeEmail(email);
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
