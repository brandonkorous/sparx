'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, toast } from '@sparx/ui';
import { FieldStatus } from '@wizeworks/silicaui-react';
import { authClient } from '@sparx/auth/client';
import { acceptInvitation } from '@/lib/org-actions';

// The accept control on /accept-invite. The server component has already
// confirmed the signed-in session matches the invited (verified) address, so
// this just fires the accept action and lands the user inside the new workspace.
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
        toast.success(`You've joined ${orgName}`);
        router.push('/');
        router.refresh();
      } else {
        setError(result.error ?? 'Could not accept the invitation.');
      }
    });
  }

  return (
    <div>
      <Button onClick={onAccept} loading={pending} disabled={pending} className="w-full">
        Accept &amp; enter {orgName}
      </Button>
      {error ? (
        <FieldStatus
          status="error"
          attached={false}
          role="alert"
          aria-live="polite"
          className="mt-2"
        >
          {error}
        </FieldStatus>
      ) : null}
    </div>
  );
}

// Sign the current (wrong) user out and send them to sign-in, preserving the
// return-to-invite callback so they can retry as the invited address. Mirrors
// the user-menu sign-out (there is no /sign-out route — it's a client action).
export function SwitchAccountButton({ callbackURL }: { callbackURL: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onSwitch() {
    startTransition(async () => {
      try {
        await authClient.signOut();
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
