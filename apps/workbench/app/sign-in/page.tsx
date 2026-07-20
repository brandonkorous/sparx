import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@sparx/auth';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in · sparx Workbench' };
export const dynamic = 'force-dynamic';

// The workbench holds its own session, host-only to workbench.sparx.works. A
// signed-in dashboard user still signs in here once — see the reasoning in
// app/api/auth/[...all]/route.ts for why sharing the cookie across subdomains
// was rejected rather than overlooked.
export default async function SignInPage() {
  const session = await getSession();
  if (session) redirect('/');

  return (
    <div className="bg-base-200 grid h-dvh place-items-center p-6">
      <SignInForm />
    </div>
  );
}
