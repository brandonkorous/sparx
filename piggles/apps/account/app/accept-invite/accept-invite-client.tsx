'use client';

// The three buttons on /accept-invite.
//
// The server component has already resolved the invitation and worked out which
// of the four states this visitor is in; each control below fires the one action
// that matches. Kept to silica primitives and the server actions so the invite
// page stays a self-contained auth surface.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button } from '@wizeworks/silicaui-react';
import { signOut } from '@sparx/auth/client';
import { acceptInvitation, resendInviteVerification } from './actions';

/**
 * Matched and verified: join, then go straight into the business.
 *
 * `/handoff` and not `/` — this app is getpiggles.com, and the business somebody
 * has just joined is on mypiggles.com. The handoff is the one door across, and
 * sending them to the account home instead would end the invitation on a page
 * about their account rather than in the team they were invited to.
 */
export function AcceptInviteButton({
  invitationId,
  orgName,
}: {
  invitationId: string;
  orgName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitation(invitationId);
      if (result.ok) {
        router.replace('/handoff');
        router.refresh();
      } else {
        setError(result.error ?? 'We could not accept that invitation.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        color="primary"
        onClick={onAccept}
        loading={pending}
        disabled={pending}
        className="w-full"
      >
        Join {orgName}
      </Button>
      {error ? (
        <Alert color="danger" variant="soft" role="alert">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}

/** Signed in as the wrong address: sign out and come back, keeping the
 *  invitation so they can retry as the address it was sent to. */
export function SwitchAccountButton({ callbackURL }: { callbackURL: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onSwitch() {
    startTransition(async () => {
      try {
        await signOut();
      } catch {
        /* even if sign-out reports a problem, still route to sign-in */
      }
      router.push(`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`);
      router.refresh();
    });
  }

  return (
    <Button
      variant="outline"
      onClick={onSwitch}
      loading={pending}
      disabled={pending}
      className="w-full"
    >
      Sign in as someone else
    </Button>
  );
}

/** Right address, unverified: resend the link, which returns here. */
export function ResendVerificationButton({
  email,
  invitationId,
}: {
  email: string;
  invitationId: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function onResend() {
    setError(null);
    startTransition(async () => {
      const result = await resendInviteVerification(email, invitationId);
      if (result.ok) setSent(true);
      else setError(result.error ?? 'We could not send that email.');
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        onClick={onResend}
        loading={pending}
        disabled={pending || sent}
        className="w-full"
      >
        {sent ? 'Sent — check your inbox' : 'Send the email again'}
      </Button>
      {sent ? (
        <Alert color="success" variant="soft" role="status">
          Check {email}, open the link, and you will come back here to finish.
        </Alert>
      ) : null}
      {error ? (
        <Alert color="danger" variant="soft" role="alert">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
