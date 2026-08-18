import type { Metadata } from 'next';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'Set a new password · sparx Workbench' };
export const dynamic = 'force-dynamic';

// The target of the password-reset email link (?token=). No session guard — a
// signed-in user who followed the link can still set a new password; the token
// is what authorizes the change.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
