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
    <AuthShell heading="Choose a new password." lede="Then we will sign you back in.">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
