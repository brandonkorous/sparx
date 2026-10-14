import type { Metadata } from 'next';
import { getSession } from '@wizeworks/auth';
import { VerifyEmailResult } from './verify-email-result';

export const metadata: Metadata = { title: 'Confirm your email · sparx Workbench' };
export const dynamic = 'force-dynamic';

// Where the confirm-your-email link comes back to (sparx persona issue 157).
// Better Auth confirms the address first, then redirects here, adding
// `?error=<CODE>` when the link did not confirm anything. With no page here, a
// link that WORKED landed on "That link doesn't open anything". Whether the
// address is confirmed is read from the session, not from the URL.
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await getSession();
  return (
    <VerifyEmailResult verified={session?.user.emailVerified === true} error={error ?? null} />
  );
}
