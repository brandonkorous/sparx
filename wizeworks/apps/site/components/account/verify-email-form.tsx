'use client';

// Opening a "confirm it's you" link (sparx persona issue 329). The token proves
// the inbox; once it does, the next account read hands over what was already
// kept under the email on this site (a guest's orders, a booking), which is
// what the link's email promised.

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';

import { useCustomer } from '@/components/customer-provider';
import { accountFailureWords, confirmEmail } from '@/lib/customer-client';

type State = 'working' | 'done' | 'failed';

export function VerifyEmailForm() {
  const { tenantSlug, refresh } = useCustomer();
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<State>(token ? 'working' : 'failed');
  const [error, setError] = useState<string | null>(
    token ? null : 'This link is missing part of its address. Open it from the email again.'
  );
  // A token is single-use: React runs an effect twice in development, and the
  // second confirm of a spent token would report a failure that never happened.
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    confirmEmail(tenantSlug, token)
      .then(async () => {
        await refresh();
        setState('done');
      })
      .catch((err: unknown) => {
        setError(accountFailureWords(err, 'This link is invalid or has expired.'));
        setState('failed');
      });
  }, [token, tenantSlug, refresh]);

  if (state === 'working') {
    return (
      <p className="text-base-content" role="status">
        Confirming your email…
      </p>
    );
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col gap-4">
        <Alert color="success" role="status">
          <AlertContent>
            <AlertTitle>Your email is confirmed</AlertTitle>
            <AlertDescription>
              Your account is ready, with everything you did here before.
            </AlertDescription>
          </AlertContent>
        </Alert>
        <div>
          <Button color="primary" render={<Link href="/account" />}>
            Go to your account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert color="danger" role="alert">
        <AlertContent>
          <AlertTitle>This link did not work</AlertTitle>
          <AlertDescription>
            {error} Sign in with the email and password you chose, and we will send a new link.
          </AlertDescription>
        </AlertContent>
      </Alert>
      <div>
        <Button color="primary" render={<Link href="/account/login" />}>
          Sign in
        </Button>
      </div>
    </div>
  );
}
