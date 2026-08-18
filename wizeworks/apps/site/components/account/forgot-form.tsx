'use client';

// Forgot-password form — request a reset link. The response is always a generic
// success (enumeration-safe): we never reveal whether the email is registered.
//
// Extracted from the old app/account/forgot/page.tsx body so it can mount as the
// `forgot` mode of the pinned `commerce.auth` core (docs/122). Self-contained (resolves
// the tenant from the CustomerProvider), including its own heading + back link, so the
// editable shell just surrounds it.

import Link from 'next/link';
import { useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import { requestPasswordReset } from '@/lib/customer-client';
import { Alert, Button, Input } from '@wizeworks/silicaui-react';

export function ForgotForm() {
  const { tenantSlug } = useCustomer();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    await requestPasswordReset(tenantSlug, email);
    setState('sent');
  }

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6">
      <h1
        className="text-base-content text-3xl font-semibold tracking-tight"
        style={{ marginBottom: '0.5rem' }}
      >
        Reset your password
      </h1>
      {state === 'sent' ? (
        <Alert color="success" role="status">
          If an account exists for <strong>{email}</strong>, we’ve sent a link to reset your
          password. Check your inbox.
        </Alert>
      ) : (
        <>
          <p className="text-base-content" style={{ marginBottom: '1.5rem' }}>
            Enter your email and we’ll send you a link to set a new password.
          </p>
          <form onSubmit={submit} className="flex max-w-[560px] flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-base-content text-sm font-medium">Email</span>
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <Button type="submit" color="primary" size="lg" disabled={state === 'busy'}>
              {state === 'busy' ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        </>
      )}
      <p className="text-base-content text-sm" style={{ marginTop: '1.5rem' }}>
        <Link href="/account/login">← Back to sign in</Link>
      </p>
    </div>
  );
}
