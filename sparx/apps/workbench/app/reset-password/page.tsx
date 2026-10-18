import type { Metadata } from 'next';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'Set a new password · sparx Workbench' };
export const dynamic = 'force-dynamic';

// The target of the password-reset email link (?token=). No session guard — a
// signed-in user who followed the link can still set a new password; the token
// is what authorizes the change.
// Opened with no token (a link cut short in a mail client, or the bare address),
// the form asked for a new password twice and only then said the link was bad
// (sparx persona issue 321). The page knows before anyone types.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const hasToken = typeof token === 'string' && token.trim() !== '';
  return <ResetPasswordForm hasToken={hasToken} />;
}
