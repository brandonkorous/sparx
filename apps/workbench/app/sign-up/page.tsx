import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@sparx/auth';
import { AuthWrapper } from '../../components/auth/auth-wrapper';
import { safeInternalPath } from '../../lib/safe-path';

export const metadata: Metadata = { title: 'Create your account · sparx Workbench' };
export const dynamic = 'force-dynamic';

// The workbench is a self-contained app (it replaces the dashboard), so it owns
// account creation too — not just sign-in. Same AuthWrapper as /sign-in, opened
// in create mode; a new account lands on `callbackURL` (default '/'), where the
// shell's first-run gate takes over and walks them through setup. `callbackURL`
// is carried through so the MCP consent flow survives a create-account detour.
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? '') : (v ?? '');

export default async function SignUpPage({ searchParams }: { searchParams: Promise<SP> }) {
  const next = safeInternalPath(one((await searchParams).callbackURL));

  const session = await getSession();
  if (session) redirect(next);

  return (
    <AuthWrapper
      initialMode="signUp"
      googleClientId={process.env.GOOGLE_CLIENT_ID}
      callbackURL={next}
    />
  );
}
