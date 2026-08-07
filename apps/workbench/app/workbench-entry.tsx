import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@sparx/auth';
import { WorkbenchShell } from '../components/workbench-shell';

// The one way into the workbench, shared by `/` and by every address under it.
//
// THE SERVER DOES NOT RESOLVE ADDRESSES. It checks the session and renders the
// shell; what `/commerce/orders/8f2…` MEANS is decided in the browser, where the
// surface registry lives. That is not a shortcut — the registry imports React
// and all 233 pane components, so a server that understood addresses would drag
// the entire interface into every request. And it turns out the server does not
// need to: preserving intent across sign-in only requires the path itself.
//
// Which is the bug this closes. `/` used to redirect a signed-out visitor with a
// bare `redirect('/sign-in')`, dropping the query entirely — so the `?open=`
// form that every backend emitter built survived a cold click only if it came
// through one of four hand-written redirect pages. Cold is the NORMAL case for a
// link in an email. Now the address rides through as `callbackURL` and comes back
// intact, whichever door it came in by.

export async function WorkbenchEntry({ address }: { address: string }) {
  const session = await getSession();
  if (!session) {
    // `address` is assembled from the matched route, never echoed from a header,
    // so it is same-origin by construction; `safeInternalPath` on the other side
    // re-checks it regardless.
    redirect(`/sign-in?callbackURL=${encodeURIComponent(address)}`);
  }

  // Read the active-site cookie server-side and hand it down as the boot key.
  // /api/token forwards this SAME cookie as `propertyId`, and the shell already
  // trusts that value as the per-site layout key — so surfacing it at SSR lets
  // the dock and toolbar mount on the first paint instead of after a token
  // round trip, for everyone who has picked a site before (the common case).
  const cookieStore = await cookies();
  const initialSiteKey = cookieStore.get('sparx_active_property')?.value ?? null;

  return (
    <WorkbenchShell
      userName={displayName(session.user.name, session.user.email)}
      userEmail={session.user.email}
      initialSiteKey={initialSiteKey}
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
