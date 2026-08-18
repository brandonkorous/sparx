import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@wizeworks/auth';
import { COMPACT_COOKIE, guessCompact } from '../lib/compact';
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
// It does, however, hand the matched address DOWN. The shell used to read
// `window.location` for itself, which is right on a cold load and wrong the one
// time it differs: signing in navigates client-side, so the shell's first render
// happens while the bar still says `/sign-in`. That was captured as a link,
// matched no route, and answered a successful sign-in with "that link doesn't
// work" — a pane that then persisted into the layout and came back on every load
// afterwards. The server knows the real address; passing it removes the guess.
//
// Which is the other bug this closes. `/` used to redirect a signed-out visitor with a
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

  // Which presentation this device gets, answered HERE so the markup that ships
  // is already the right one. Guessing desktop and correcting after hydration is
  // a phone painting the rail and the dock before swapping them (lib/compact.ts).
  const requestHeaders = await headers();
  const initialCompact = guessCompact({
    cookie: cookieStore.get(COMPACT_COOKIE)?.value,
    chMobile: requestHeaders.get('sec-ch-ua-mobile'),
    userAgent: requestHeaders.get('user-agent'),
  });

  return (
    <WorkbenchShell
      userName={displayName(session.user.name, session.user.email)}
      userEmail={session.user.email}
      initialSiteKey={initialSiteKey}
      initialCompact={initialCompact}
      arrivalAddress={address}
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
