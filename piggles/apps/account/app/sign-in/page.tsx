import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@wizeworks/auth';
import { returnPath } from '@piggles/auth-handoff';
import { AuthShell } from '@/components/auth-shell';
import { BrandPanel } from '@/components/brand-panel';
import { SignInForm } from '@/components/sign-in-form';
import { googleSignInAvailable } from '@/lib/social';
import { joiningFrom } from '@/lib/invite-joining';
import { withSource } from '@/lib/signup-source';

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

  // Google makes an account when the email is new, so the source rides along to
  // the junction, which records it and sends a new business to setup.
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));
  const formNext = next === '/' ? withSource('/', one(sp.from), one(sp.a)) : next;

  // On the way to accept an invitation: name the business being joined.
  const joining = await joiningFrom(next);

  return (
    <AuthShell
      heading={joining ? `Sign in to join ${joining.orgName}` : 'Welcome back.'}
      lede={
        joining
          ? `Use ${joining.email}, the address your invitation went to.`
          : "Good to see you. Let's get back to it."
      }
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
          {joining ? '.' : '. Fourteen days free, no card.'}
        </p>
      }
    >
      <SignInForm next={formNext} google={googleSignInAvailable()} />
    </AuthShell>
  );
}
