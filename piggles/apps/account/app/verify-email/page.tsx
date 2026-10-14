import type { Metadata } from 'next';
import { getSession } from '@wizeworks/auth';
import { VerifyEmailResult } from './verify-email-result';

export const metadata: Metadata = { title: 'Confirm your email' };
export const dynamic = 'force-dynamic';

// Where the confirm-your-email link comes back to, and where the console's band
// sends an owner for a new link (sparx persona issue 157). Whether the address
// is confirmed is read from the session, not from the URL.
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; send?: string }>;
}) {
  const { error, send } = await searchParams;
  const session = await getSession();
  return (
    <VerifyEmailResult
      signedIn={session !== null}
      verified={session?.user.emailVerified === true}
      error={error ?? null}
      send={send ?? null}
    />
  );
}
