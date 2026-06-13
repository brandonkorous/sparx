'use client';

import * as React from 'react';
import { MailWarning } from 'lucide-react';
import { Alert, Button } from '@sparx/ui';
import { authClient } from '@sparx/auth/client';

const DISMISS_KEY = 'sparx.verifyEmailBanner.dismissed';

// Verify-but-don't-block nudge (Slice 2). Rendered at the top of the dashboard
// when the signed-in user's email isn't verified — basic dashboard use stays
// open; only sensitive actions gate. Dismissible for the browser session.
export function EmailVerificationBanner({ email }: { email: string }) {
  // Start hidden until we've read sessionStorage so a prior dismissal doesn't
  // flash the banner back in on every navigation.
  const [hidden, setHidden] = React.useState(true);
  const [resending, setResending] = React.useState(false);
  const [resent, setResent] = React.useState(false);

  React.useEffect(() => {
    setHidden(sessionStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  if (hidden) return null;

  async function resend() {
    setResending(true);
    try {
      await authClient.sendVerificationEmail({ email, callbackURL: '/verify-email' });
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  }

  return (
    <Alert
      color="warning"
      variant="soft"
      icon={<MailWarning />}
      title="Confirm your email"
      onDismiss={dismiss}
      className="mb-6"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span>
          Verify <strong>{email}</strong> to unlock custom domains, going live, and sending email.
        </span>
        {resent ? (
          <span className="font-medium">Sent — check your inbox.</span>
        ) : (
          <Button size="sm" onClick={resend} disabled={resending} loading={resending}>
            Resend email
          </Button>
        )}
      </div>
    </Alert>
  );
}
