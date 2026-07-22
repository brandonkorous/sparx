import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@sparx/auth';
import { AuthWrapper } from '../../components/auth/auth-wrapper';
import { safeInternalPath } from '../../lib/safe-path';

export const metadata: Metadata = { title: 'Sign in · sparx Workbench' };
export const dynamic = 'force-dynamic';

// The workbench holds its own session, host-only to its origin. A signed-in
// dashboard user still signs in here once — see the reasoning in
// app/api/auth/[...all]/route.ts for why sharing the cookie across subdomains
// was rejected rather than overlooked.
//
// /sign-in and /sign-up render the SAME AuthWrapper (which toggles between the
// two in place); the route only sets the initial mode and guards the session.
// googleClientId is read from the server env at request time — no NEXT_PUBLIC
// bake — so the portable image resolves it per environment and can drive One Tap.
//
// `callbackURL` funnels the MCP OAuth consent flow: an operator who isn't signed
// in when they hit /oauth/consent is sent here with the consent path attached,
// and every sign-in method returns them to it (sanitized to a same-origin path).
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? '') : (v ?? '');

export default async function SignInPage({ searchParams }: { searchParams: Promise<SP> }) {
  const next = safeInternalPath(one((await searchParams).callbackURL));

  const session = await getSession();
  if (session) redirect(next);

  return (
    <AuthWrapper
      initialMode="signIn"
      googleClientId={process.env.GOOGLE_CLIENT_ID}
      callbackURL={next}
    />
  );
}
