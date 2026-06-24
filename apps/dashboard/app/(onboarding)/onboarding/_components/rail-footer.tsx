'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@sparx/auth/client';

// The onboarding rail's footer: a help link and a save-and-exit. Lives ON the
// solid module-color rail, so the links inherit the rail's white/60 tone (set by
// SurfaceFrame) and brighten on hover — not @sparx/ui Button colors, which are
// tuned for light surfaces. Progress is persisted server-side after every step,
// so signing out drops the tenant back on their saved step next time.
export function RailFooter() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function signOut() {
    startTransition(async () => {
      try {
        await authClient.signOut();
      } finally {
        router.push('/sign-in');
        router.refresh();
      }
    });
  }

  return (
    <>
      <a href="mailto:help@sparx.works" className="transition-colors hover:text-white">
        Need help?
      </a>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="transition-colors hover:text-white disabled:opacity-60"
      >
        Save &amp; exit
      </button>
    </>
  );
}
