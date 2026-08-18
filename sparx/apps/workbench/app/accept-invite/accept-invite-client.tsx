'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button } from '@wizeworks/silicaui-react';
import { signOut } from '@wizeworks/auth/client';
import { acceptInvitation, resendInviteVerification } from './actions';

// The interactive controls on /accept-invite. The server component has already
// resolved the invitation and branched on auth state; these fire the matching
// action. Kept dependency-light (silica primitives + the server actions) so the
// invite page stays a self-contained auth surface, not a dock pane.

/** Matched + verified: accept the invite and land inside the new workspace. */
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
        router.replace('/');
        router.refresh();
      } else {
        setError(result.error ?? 'Could not accept the invitation.');
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
        Accept &amp; enter {orgName}
      </Button>
      {error ? (
        <Alert color="danger" variant="soft" role="alert">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}

/** Signed in as the wrong address: sign out and return to sign-in, preserving the
 *  return-to-invite callback so they can retry as the invited address. */
export function SwitchAccountButton({ callbackURL }: { callbackURL: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onSwitch() {
    startTransition(async () => {
      try {
        await signOut();
      } catch {
        /* even if sign-out reports an error, still route to sign-in */
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
      Switch account
    </Button>
  );
}

/** Matched address but email not verified: resend the verification link (which
 *  returns here so they can accept once verified). */
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
      else setError(result.error ?? 'Could not send the verification email.');
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
        {sent ? 'Verification email sent' : 'Resend verification email'}
      </Button>
      {sent ? (
        <Alert color="success" variant="soft" role="status">
          Check your inbox for {email}, open the link, and you&rsquo;ll return here to accept.
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
