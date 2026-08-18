import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@wizeworks/auth';
import { safeInternalPath } from '@piggles/config';
import { AuthShell } from '@/components/auth-shell';
import { BrandPanel } from '@/components/brand-panel';
import { SignInForm } from '@/components/sign-in-form';
import { googleSignInAvailable } from '@/lib/social';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? '') : (v ?? '');

export default async function SignInPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const next = safeInternalPath(one(sp.next));

  if (await getSession()) redirect(next);

  return (
    <AuthShell
      heading="Welcome back."
      lede="Good to see you. Let's get back to it."
      // The marketing site's own closing line, which is the right one here: a
      // returning customer is not being sold to, they are being let back in to
      // get on with the day.
      panel={
        <BrandPanel lead="Go and run the business." emphasis="Piggles handles the software." />
      }
      aside={
        <p>
          New here?{' '}
          <Link href="/signup" className="text-primary font-semibold">
            Create an account
          </Link>{' '}
          — fourteen days free, no card.
        </p>
      }
    >
      <SignInForm next={next} google={googleSignInAvailable()} />
    </AuthShell>
  );
}
