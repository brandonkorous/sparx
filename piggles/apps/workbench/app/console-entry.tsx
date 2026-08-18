import { cookies } from 'next/headers';
import { accountOrigin } from '@piggles/auth-handoff';
import { requireConsoleSession } from '@/lib/session';
import { ConsoleShell } from '@/components/console-shell';

// The one way into the console, shared by `/` and by every address under it.
//
// THE SERVER DOES NOT RESOLVE ADDRESSES. It checks the session and renders the
// shell; what `/sell/orders/8f2…` MEANS is decided in the browser, where the
// surface registry lives. That is not a shortcut — the registry imports React
// and every pane component, so a server that understood addresses would drag the
// entire interface into every request. And it turns out the server does not need
// to: preserving intent across the sign-in hop only requires the path itself.
//
// It does hand the matched address DOWN rather than letting the shell read
// `window.location`. The shell's history bridge starts replacing the address bar
// with the focused pane's address as soon as the layout restores, so an address
// read any later than the first render is an address already overwritten — and
// on a client-side arrival the bar has not caught up at all. The server knows
// what was actually asked for.

export async function ConsoleEntry({ address }: { address: string }) {
  // Not signed in: out to the account app, with the address in hand so the round
  // trip lands where it was going. `address` is assembled from the matched route
  // and never echoed from a header, so it is same-origin by construction;
  // `safeInternalPath` re-checks it on the way back regardless.
  const session = await requireConsoleSession(address);

  // Read the active-site cookie server-side and hand it down as the boot key.
  // /api/token forwards this SAME cookie as `propertyId`, and the shell trusts
  // that value as the per-site layout key — so surfacing it at SSR lets the dock
  // and toolbar mount on the first paint instead of after a token round trip,
  // for everyone who has picked a site before (the common case).
  const cookieStore = await cookies();
  const initialSiteKey = cookieStore.get('piggles_active_property')?.value ?? null;

  return (
    <ConsoleShell
      userName={displayName(session.user.name, session.user.email)}
      userEmail={session.user.email}
      initialSiteKey={initialSiteKey}
      arrivalAddress={address}
      // Resolved on the SERVER and handed down. `PIGGLES_ACCOUNT_ORIGIN` is not
      // a `NEXT_PUBLIC_` variable and the helper that reads it imports
      // @wizeworks/db, so a client component asking this question would pull Prisma
      // into the browser bundle to learn something the server already knew.
      accountOrigin={accountOrigin()}
    />
  );
}

/**
 * `name` is nullable AND can be a blank string, so neither `??` (which keeps '')
 * nor a bare truthiness check (which trips the nullish-coalescing lint rule)
 * covers both cases on its own.
 */
function displayName(name: string | null | undefined, email: string): string {
  const trimmed = name?.trim();
  if (!trimmed) return email;
  return trimmed;
}
