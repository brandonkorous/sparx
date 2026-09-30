import type { Metadata } from 'next';
import { ForgotPasswordScreen } from '@/components/password-reset-forms';

export const metadata: Metadata = { title: 'Reset your password' };

// The shell moved INTO the screen component, and the reason is a state change.
//
// This page used to hold `<AuthShell heading lede>` with the form inside it, so
// the heading and the lede were server-rendered constants while the only thing
// that could change was the form. Sending the link therefore produced a screen
// that still said "Tell us the email you sign in with and we will send you a
// link" above a green box saying the link was already on its way, with no field
// left to use. A screen whose heading has to answer to a state cannot keep that
// heading above the state. See the note in password-reset-forms.tsx.
//
// No panel beside either state, also deliberately: sign-in and signup are front
// doors and can carry a promise beside them, but this is a repair. Somebody is
// locked out of their own business and wants one thing to happen, and the
// product's pitch next to that reads as a company talking about itself while a
// customer is stuck. The shell, the wash and the assurance strip still hold the
// screen together as the same product; what is missing is the argument, because
// the argument is over.

export default function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
