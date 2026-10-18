'use client';

// "Check your email" (sparx persona issue 329). The account exists and is signed
// in, but something was already kept under this email on this site (a guest's
// orders, a booking), and it is not handed to a login until the inbox is shown
// to be theirs. Says nothing about WHAT is kept: whoever reads this page may not
// be the person who owns the address.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';

import { useCustomer } from '@/components/customer-provider';
import { accountFailureWords, resendEmailConfirmation } from '@/lib/customer-client';

export function ConfirmEmailNotice({ email, sent = true }: { email: string; sent?: boolean }) {
  const { tenantSlug, logout } = useCustomer();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  // The link went at sign-up, or a resend since. False until one has (issue 337).
  const linkWent = sent || state === 'sent';
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setState('sending');
    setError(null);
    try {
      await resendEmailConfirmation(tenantSlug);
      setState('sent');
    } catch (err) {
      setError(accountFailureWords(err, 'The link could not be sent. Try again in a minute.'));
      setState('idle');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {linkWent ? (
        <Alert color="info" role="status">
          <AlertContent>
            <AlertTitle>Check your email</AlertTitle>
            <AlertDescription>
              We sent a link to <span className="font-semibold break-words">{email}</span>. Open it
              to finish your account. The link works for one hour.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : (
        <Alert color="warning" role="status">
          <AlertContent>
            <AlertTitle>We could not send the link</AlertTitle>
            <AlertDescription>
              Your account is made, and it needs a link sent to{' '}
              <span className="font-semibold break-words">{email}</span> to finish. It could not be
              sent just now. Press Send the link again in a minute.
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          color="primary"
          variant="outline"
          loading={state === 'sending'}
          disabled={state === 'sending'}
          onClick={() => void resend()}
        >
          {state === 'sent' ? 'Sent. Send it again' : 'Send the link again'}
        </Button>
        <Button variant="ghost" onClick={() => void logout()}>
          Use a different email
        </Button>
      </div>
    </div>
  );
}
