import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@wizeworks/auth';
import { returnPath } from '@piggles/auth-handoff';
import { AuthShell } from '@/components/auth-shell';
import { BrandPanel } from '@/components/brand-panel';
import { SignInForm } from '@/components/sign-in-form';
import { googleSignInAvailable } from '@/lib/social';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

export default async function SignInPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  // Either spelling. The invitation's own buttons write `callbackURL`, and
  // reading only `next` is what made "Sign in to join" sign people in without
  // joining them (issue 881).
  const next = returnPath(sp);

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
          {/* Carries where they were going. Somebody who followed an invitation
              here and then realises they have no account yet must not lose the
              invitation by clicking the one link offered to them. */}
          <Link
            href={next === '/' ? '/signup' : `/signup?next=${encodeURIComponent(next)}`}
            className="text-primary font-semibold"
          >
            Create an account
          </Link>
          . Fourteen days free, no card.
        </p>
      }
    >
      <SignInForm next={next} google={googleSignInAvailable()} />
    </AuthShell>
  );
}
