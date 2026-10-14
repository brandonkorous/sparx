'use client';

// The result of pressing the confirm-your-email link, or the place to ask for a
// new one (sparx persona issue 157).

import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from '@wizeworks/silicaui-react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';

import { AuthShell } from '@/components/auth-shell';
import { linkSentWords, sendsOnArrival, verifyLandingWords } from '@/lib/verify-email-landing';
import { sendConfirmLink } from './actions';

export function VerifyEmailResult({
  signedIn,
  verified,
  error,
  send: sendParam,
}: {
  signedIn: boolean;
  verified: boolean;
  error: string | null;
  /** `1` when the console's "Send the link again" opened this page. */
  send: string | null;
}) {
  const words = verifyLandingWords({ verified, error });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setFailure(null);
    const result = await sendConfirmLink();
    setSending(false);
    if (result.ok) setSent(linkSentWords(result.email ?? 'your address'));
    else setFailure(result.error ?? 'The link didn’t send. Try again in a minute.');
  };

  // The console's band said "Send the link again", so arriving from it sends one
  // (piggles persona issue 978). Once only: the ref holds through React's double
  // mount in dev, and the `send` mark leaves the address so a reload sends nothing.
  const sentOnArrival = useRef(false);
  useEffect(() => {
    if (sentOnArrival.current || !sendsOnArrival({ signedIn, verified, send: sendParam })) return;
    sentOnArrival.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    void send();
    // `send` is recreated every render; this runs for the arrival alone.
  }, [signedIn, verified, sendParam]);

  return (
    <AuthShell heading={words.heading} lede={words.lede}>
      <div className="flex flex-col gap-4">
        {sent ? (
          <Alert color="success" variant="soft" role="status">
            {sent}
          </Alert>
        ) : null}
        {failure ? (
          <Alert color="danger" variant="soft" role="alert">
            {failure}
          </Alert>
        ) : null}
        {!signedIn ? (
          <a className={buttonClasses({ color: 'primary' })} href="/sign-in?next=%2Fverify-email">
            Sign in to ask for a new link
          </a>
        ) : words.confirmed ? (
          <a className={buttonClasses({ color: 'primary' })} href="/handoff">
            Go to your console
          </a>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              color="primary"
              loading={sending}
              onClick={() => {
                void send();
              }}
            >
              Send a new link
            </Button>
            <a className={buttonClasses({ variant: 'outline' })} href="/handoff">
              Go to your console
            </a>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
