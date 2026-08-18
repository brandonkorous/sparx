import { redirect } from 'next/navigation';
import { getOperatorSession } from '@wizeworks/operator-auth/next';
import { TwoFactorSetupForm } from './two-factor-setup-form';

// Mandatory MFA enrollment for operators (docs/16 §2.4).
//
// This route sits in the (auth) group, OUTSIDE the console shell, for a
// structural reason rather than a cosmetic one: `requireOperator()` redirects
// every un-enrolled operator here, so if this page were inside the console it
// would redirect to itself forever. It gates on the session directly and lets an
// un-enrolled operator through — the one place in the app that does.
//
// The two ways out are both correct endings: finish setup and land in the
// console, or sign out. There is deliberately no "skip" — the whole point of
// enforcing it at the gate is that there isn't one.

export const dynamic = 'force-dynamic';

export default async function TwoFactorSetupPage() {
  const operator = await getOperatorSession();
  if (!operator) redirect('/sign-in');
  // Already enrolled — nothing to do here, and leaving the setup screen
  // reachable would let an operator re-run it for no reason.
  if (operator.twoFactorEnabled) redirect('/');

  return <TwoFactorSetupForm email={operator.email} />;
}
