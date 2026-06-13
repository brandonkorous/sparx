import { getSession } from '@sparx/auth';
import { VerifyEmailClient } from './verify-email-client';

// Reached from the verification email link: Better Auth's verify endpoint does
// the token check, then redirects here (to callbackURL='/verify-email' on
// success, or with an `?error=` param on a bad/expired token). We resolve the
// signed-in email server-side so the client island can offer a direct resend
// without a client-side session hook (useSession isn't SSR-safe here).
export default async function VerifyEmailPage() {
  const session = await getSession();
  return <VerifyEmailClient email={session?.user.email ?? null} />;
}
