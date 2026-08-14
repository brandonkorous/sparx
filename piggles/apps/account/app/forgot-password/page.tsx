import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { ForgotPasswordForm } from '@/components/password-reset-forms';

export const metadata: Metadata = { title: 'Reset your password' };

// No panel beside this one, deliberately.
//
// Sign-in and signup are front doors, and a front door can carry a promise
// beside it. This is a repair: somebody is locked out of their own business and
// wants one thing to happen. Putting the product's pitch next to that reads as
// a company talking about itself while a customer is stuck. The shell, the wash
// and the assurance strip still hold the screen together as the same product —
// what is missing is the argument, because the argument is over.

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      heading="Let's get you back in."
      lede="Tell us the email you sign in with and we will send you a link to set a new password."
      aside={
        <p>
          Remembered it?{' '}
          <Link href="/sign-in" className="text-primary font-semibold">
            Sign in
          </Link>
          .
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
