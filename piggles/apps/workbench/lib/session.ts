import { redirect } from 'next/navigation';
import { getSession, type SparxSession } from '@sparx/auth';
import { handoffEntryUrl } from '@piggles/auth-handoff';

// Who is signed in — and where an unsigned visitor goes.
//
// The platform ships `requireSession()`, and the console cannot use it: it
// redirects to `/sign-in`, a route that does not exist here and never will. The
// console has NO sign-in UI at all (piggles/CLAUDE.md: `getpiggles.com` is the
// auth authority), so an unauthenticated visitor has to leave the domain
// entirely.
//
// ── WHY IT BOUNCES TO `/handoff` AND NOT TO `/sign-in` ──────────────────────
//
// The obvious destination is the account app's sign-in form. It is the wrong
// one. Most visitors arriving here without a console cookie are already signed
// in on getpiggles — a bookmark, a link from an email, a cookie this domain
// happened to lose — and sending them to a sign-in form asks them to
// authenticate a second time for the same session. `/handoff` checks first: a
// signed-in visitor gets a fresh token and comes straight back, and only a
// genuinely signed-out one is shown a form.
//
// The address they asked for rides along as `?next=`, through the sign-in and
// back through the handoff, so a deep link into a pane survives the round trip.
// That is the difference between "sign in, then find your way back" and simply
// arriving.

export type ConsoleSession = SparxSession;

/**
 * The session, or a redirect out to the account app.
 *
 * `next` is the address the visitor asked for, so they land there rather than on
 * the console root. Pass the address the SERVER matched — never one echoed from
 * a header.
 */
export async function requireConsoleSession(next: string): Promise<ConsoleSession> {
  const session = await getSession();
  if (!session) {
    redirect(handoffEntryUrl(next));
  }
  return session;
}
