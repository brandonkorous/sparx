'use client';

// Forgot password — request a reset link. The response is always a generic
// success (enumeration-safe): we never reveal whether the email is registered.

import Link from 'next/link';
import { useState } from 'react';

import { SparxAlert, SparxButton, SparxInput } from '@sparx/site-ui';

import { useCustomer } from '@/components/customer-provider';
import { requestPasswordReset } from '@/lib/customer-client';

export default function ForgotPasswordPage() {
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
    <div className="st-container">
      <div className="st-container--prose" style={{ paddingBlock: '2.5rem' }}>
        <h1 className="st-h2" style={{ marginBottom: '0.5rem' }}>
          Reset your password
        </h1>
        {state === 'sent' ? (
          <SparxAlert color="success" role="status">
            If an account exists for <strong>{email}</strong>, we’ve sent a link to reset your
            password. Check your inbox.
          </SparxAlert>
        ) : (
          <>
            <p className="st-muted" style={{ marginBottom: '1.5rem' }}>
              Enter your email and we’ll send you a link to set a new password.
            </p>
            <form onSubmit={submit} className="st-form">
              <label className="st-field">
                <span>Email</span>
                <SparxInput
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <SparxButton type="submit" color="primary" size="lg" disabled={state === 'busy'}>
                {state === 'busy' ? 'Sending…' : 'Send reset link'}
              </SparxButton>
            </form>
          </>
        )}
        <p className="st-muted" style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
          <Link href="/account/login">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
