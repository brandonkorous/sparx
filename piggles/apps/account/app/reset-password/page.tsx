import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { AuthShell } from '@/components/auth-shell';
import { ResetPasswordForm } from '@/components/password-reset-forms';

export const metadata: Metadata = { title: 'Choose a new password' };
export const dynamic = 'force-dynamic';

// Like /forgot-password: the repair screens carry no panel. See that file.

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? '') : (v ?? '');

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<SP> }) {
  const token = one((await searchParams).token);

  // No token means the link was truncated by an email client, or somebody
  // reached this URL directly. Showing the form anyway would let them type a
  // new password and then fail — better to say what happened and offer the way
  // to get a working link.
  if (!token) {
    return (
      <AuthShell
        heading="That link is incomplete."
        lede="Some email apps cut long links in half. Ask for a new one and it should arrive intact."
      >
        {/* `buttonClasses`, not the literal `btn btn-primary …` string this used
            to carry. Same output, but it goes through the component library's own
            resolver — so a change to how a primary button is built reaches this
            link too, which is the whole reason the props exist (root RULE #1). */}
        <Link
          href="/forgot-password"
          className={buttonClasses({ color: 'primary', size: 'lg', block: true })}
        >
          Send me a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Choose a new password."
      // NOT "Then we will sign you back in." A completed reset stores the
      // password and returns `{status: true}` — it mints no session, and this
      // form's own success path is `router.push('/sign-in')`. So the screen
      // promised a thing the code has never done, to somebody who then has to
      // type the new password again (and, with two-step turned on, a code as
      // well). [[feedback_a_promise_in_copy_is_a_contract]]
      lede="Then sign in with it."
      // ── THE WAY OUT, BEFORE IT IS NEEDED ──────────────────────────────────
      //
      // The no-token branch above gets a button. The EXPIRED-token case did
      // not: it rendered "That link has expired or has already been used.
      // Please request a new one." inside an Alert on a screen carrying no link
      // to anywhere — two password boxes, a Save button, and advice with no
      // control to act on it. Naming a remedy the screen does not offer is the
      // same failure as naming the wrong cause, and this page was already fixed
      // once for the second one. [[feedback_one_outcome_two_causes]]
      //
      // Standing rather than conditional, because expiry is not the only way to
      // arrive here holding a link that will not work, and the line costs
      // nothing in the ordinary case.
      aside={
        <p>
          Link not working?{' '}
          <Link href="/forgot-password" className="text-primary font-semibold">
            Send me a new one
          </Link>
          .
        </p>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
