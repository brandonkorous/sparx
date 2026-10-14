'use client';

// The bar that says the owner's email address is not confirmed yet (sparx
// persona issue 157). Same slot and same shape as the lifecycle band: an
// unconfirmed address is account state, and the account app owns the answer, so
// the button is a door to getpiggles.com, where the new link is sent from and
// where it lands. Not dismissible: the refusals it explains do not go away.
// The door carries `?send=1`, so the page sends the link the button names on
// arrival; it used to open a page asking for a second press (piggles persona
// issue 978).

import { Button } from '@wizeworks/silicaui-react';
import { useViewer } from '@/lib/api/shell-data';
import { verifyEmailNotice } from '@/lib/verify-email-words';

export function VerifyEmailBand({ accountOrigin }: { accountOrigin: string }) {
  const { data: viewer } = useViewer();
  const notice = verifyEmailNotice(viewer);
  if (!notice) return null;

  return (
    <aside
      aria-label="Your email address"
      className="bg-warning text-warning-content flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-center"
    >
      <p className="text-base font-medium">{notice.sentence}</p>
      <Button
        // No `color`: the bar is already the tone (see lifecycle-band.tsx).
        variant="outline"
        size="sm"
        onClick={() => {
          window.location.href = `${accountOrigin}/verify-email?send=1`;
        }}
      >
        {notice.action}
      </Button>
    </aside>
  );
}
