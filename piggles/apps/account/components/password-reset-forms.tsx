'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  AlertDescription,
  Button,
  Field,
  FieldLabel,
  Input,
  PasswordInput,
} from '@wizeworks/silicaui-react';
import { authClient } from '@wizeworks/auth/client';
import { normalizeEmail } from '@piggles/config';

// The two halves of a password reset.
//
// ── THE REQUEST FORM ALWAYS SAYS THE SAME THING ─────────────────────────────
//
// Whether or not the address has an account, the answer is "if that address has
// an account, a link is on its way". Reporting the difference turns this form
// into a free tool for checking which of a list of stolen addresses are
// customers here. The cost is that somebody who typo'd their address waits for
// an email that never arrives — which is why the wording says "if", out loud,
// rather than implying delivery.

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // `requestPasswordReset`, NOT `forgetPassword`. Both names exist on this
    // client and they are not the same thing: the emailOTP plugin claims
    // `forgetPassword` as a NAMESPACE (`forgetPassword.emailOtp`), so calling it
    // directly is not even callable. This is the call sparx/apps/workbench uses.
    //
    // The result is deliberately ignored: success and "no such user" must be
    // indistinguishable, and a transient failure is better swallowed than turned
    // into a signal about whether the address exists.
    // Normalised with the same function that stored it — a reset request for an
    // address that differs only by case or a stray space would silently match
    // nothing, and this form cannot tell the person that (it deliberately gives
    // the same answer either way), so they would wait for an email that was
    // never going to come.
    await authClient
      .requestPasswordReset({ email: normalizeEmail(email), redirectTo: '/reset-password' })
      .catch(() => undefined);
    setBusy(false);
    setSent(true);
  }

  if (sent) {
    return (
      <Alert color="success" variant="soft">
        <AlertDescription>
          If that address has a Piggles account, a link to set a new password is on its way. It is
          good for the next hour.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Field>
        <FieldLabel>Email</FieldLabel>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          size="lg"
          type="email"
          autoComplete="email"
          placeholder="you@yourbusiness.com"
          required
        />
      </Field>
      <Button type="submit" color="primary" size="lg" block loading={busy}>
        Send me a link
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Please use at least 8 characters.');
      return;
    }
    // Checked here rather than only on the server: a mismatch is the user's own
    // typo, and a round trip to be told so is a round trip wasted.
    if (password !== confirm) {
      setError('Those two do not match.');
      return;
    }

    setBusy(true);
    setError(null);
    const res = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);

    if (res.error) {
      // ── SAY WHICH THING WENT WRONG ─────────────────────────────────────────
      //
      // This used to report EVERY failure as "that link has expired or has
      // already been used". It is four different failures — the API answers
      // INVALID_TOKEN, PASSWORD_TOO_SHORT, PASSWORD_TOO_LONG or INVALID_PASSWORD
      // — and naming the wrong one sends somebody off to request a fresh link
      // when the link was fine and the password was simply too short. That
      // happened, on a token this code had confirmed was still valid in the
      // database, and it cost an hour.
      //
      // Unlike SIGN-IN, there is nothing to protect by being vague here. The
      // ambiguity on the sign-in form is deliberate — it refuses to reveal
      // whether an address has an account. Whoever is on THIS screen already
      // holds a single-use token proving they control the mailbox, so precision
      // costs nothing and vagueness costs them the reset.
      const code = res.error.code;
      setError(
        code === 'PASSWORD_TOO_SHORT'
          ? 'That password is too short — please use at least 8 characters.'
          : code === 'PASSWORD_TOO_LONG'
            ? 'That password is too long. Something under 128 characters will do.'
            : code === 'INVALID_TOKEN'
              ? 'That link has expired or has already been used. Please request a new one.'
              : // Anything unmapped shows what the server actually said rather
                // than a guess dressed as a diagnosis.
                (res.error.message ?? 'That did not work. Please request a new link.')
      );
      return;
    }
    router.push('/sign-in');
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {error ? (
        <Alert color="danger" variant="soft">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Field>
        <FieldLabel>New password</FieldLabel>
        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          size="lg"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      <Field>
        <FieldLabel>Type it once more</FieldLabel>
        <PasswordInput
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          size="lg"
          autoComplete="new-password"
          required
        />
      </Field>

      <Button type="submit" color="primary" size="lg" block loading={busy}>
        Save my new password
      </Button>
    </form>
  );
}
