import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@sparx/auth';
import { PRODUCT } from '@piggles/config';
import { AuthShell } from '@/components/auth-shell';
import { BrandPanel } from '@/components/brand-panel';
import { SignUpForm } from '@/components/signup-form';
import { googleSignInAvailable } from '@/lib/social';

export const metadata: Metadata = { title: 'Create your account' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? '') : (v ?? '');

export default async function SignUpPage({ searchParams }: { searchParams: Promise<SP> }) {
  // Somebody already signed in who lands on /signup wanted their account, not a
  // second one. Sending them onward is the only reading of that click that is
  // ever right.
  if (await getSession()) redirect('/');

  const from = one((await searchParams).from);

  return (
    <AuthShell
      heading="Let's get you started."
      lede="Fourteen days free. No card needed."
      panel={<BrandPanel lead="Set it up once." emphasis="Then just run the place." />}
      aside={
        <p>
          Already have an account?{' '}
          <Link href="/sign-in" className="text-primary font-semibold">
            Sign in
          </Link>
          .
        </p>
      }
      footer={
        // ONE template literal, not JSX prose around an expression. This
        // sentence has now produced "Pigglesterms" on a live page twice, and the
        // two obvious fixes are both unstable:
        //
        //   • As JSX prose, the text chunk AFTER an expression container loses
        //     its leading space when that chunk wraps onto a second source line.
        //     So the sentence renders correctly at one length and silently
        //     breaks when somebody adds four words to it.
        //   • An explicit {' '} fixes it — until prettier finds the line short
        //     enough to collapse, and deletes the {' '} as redundant. Which is
        //     exactly what happened here.
        //
        // Inside a template literal there is no JSX whitespace rule to apply and
        // nothing for a formatter to reflow, so the string that ships is the
        // string that is written, at any length. Keep it that way.
        //
        // Worth the comment because of HOW it fails: invisible in the source,
        // invisible to typecheck, invisible to lint, and visible only to
        // somebody reading the rendered page.
        //
        // Line comments, not a block comment: this is a prop's expression
        // container, so the JSX `{/* … */}` form is a syntax error here.
        <p>{`Creating an account means you agree to the ${PRODUCT.name} terms and privacy policy.`}</p>
      }
    >
      <SignUpForm from={from} google={googleSignInAvailable()} />
    </AuthShell>
  );
}
