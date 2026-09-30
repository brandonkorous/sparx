'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Alert,
  AlertDescription,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  PasswordInput,
} from '@wizeworks/silicaui-react';
import { authClient } from '@wizeworks/auth/client';
import { normalizeEmail } from '@piggles/config';
import { AuthShell } from './auth-shell';

// The two halves of a password reset.
//
// ── THE REQUEST SCREEN ALWAYS SAYS THE SAME THING ───────────────────────────
//
// Whether or not the address has an account, the answer is "if that address has
// an account, a link is on its way". Reporting the difference turns this form
// into a free tool for checking which of a list of stolen addresses are
// customers here. The cost is that somebody who typo'd their address waits for
// an email that never arrives — which is why the wording says "if", out loud,
// rather than implying delivery, AND why the sent screen keeps a way back to
// the form. See the next note.
//
// ── WHY THE REQUEST SCREEN OWNS ITS OWN SHELL ───────────────────────────────
//
// It used to be a server page holding `<AuthShell heading lede>` with this form
// inside it, and the form swapped only ITSELF for a green box. So the sent
// screen read:
//
//     Let's get you back in.
//     Tell us the email you sign in with and we will send you a link.
//     [ a link is on its way ]
//
// — a standing instruction to do the thing that had just been done, above a
// box saying it was done, with no field left to do it in. The heading and the
// lede have to change when the state changes, so the state has to live above
// them. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// The second half of that is the way BACK. This form's whole accepted cost is
// that a mistyped address looks exactly like a correct one, and the old sent
// screen offered nothing but a browser reload — so the one person the design
// knowingly fails was the one person it stranded. The address is kept in state
// rather than cleared, so going back shows what was typed and she edits the
// typo instead of retyping the lot.

export function ForgotPasswordScreen() {
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
    // never going to come. MEASURED 2026-09-25: `  P03.Devi@Piggles.TEST  `
    // produced a token for p03.devi@piggles.test, so the normalising is real.
    await authClient
      .requestPasswordReset({ email: normalizeEmail(email), redirectTo: '/reset-password' })
      .catch(() => undefined);
    setBusy(false);
    setSent(true);
  }

  const aside = (
    <p>
      Remembered it?{' '}
      <Link href="/sign-in" className="text-primary font-semibold">
        Sign in
      </Link>
      .
    </p>
  );

  if (sent) {
    return (
      // No panel beside this one, deliberately. Sign-in and signup are front
      // doors, and a front door can carry a promise beside it. This is a repair:
      // somebody is locked out of their own business and wants one thing to
      // happen. Putting the product's pitch next to that reads as a company
      // talking about itself while a customer is stuck.
      <AuthShell
        heading="Check your email."
        // The sentence the old green box carried. It is the whole content of
        // this screen, so it is the lede rather than an Alert inside a card
        // under a heading that says something else. "It is good for the next
        // hour" is MEASURED, not assumed: the stored token's window is exactly
        // 01:00:00 (better-auth's `resetPasswordTokenExpiresIn` default of 3600
        // seconds, which nothing here overrides), and the email says 60 minutes.
        // [[feedback_a_promise_in_copy_is_a_contract]]
        lede="If that address has a Piggles account, a link to set a new password is on its way. It is good for the next hour."
        aside={aside}
      >
        <div className="flex flex-col gap-4">
          <p className="text-base">
            It can take a minute to arrive, and it is worth a look in your spam folder. Sent it to
            the wrong address? Go back and fix it.
          </p>
          {/* COLORLESS on purpose, which is a different thing from naming
              `neutral` and needs no approval (RULE #4). Nothing here is the
              point of the screen — the point already happened — so this is a
              way back rather than an action to take. */}
          <Button variant="outline" size="lg" block onClick={() => setSent(false)}>
            Use a different address
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Let's get you back in."
      lede="Tell us the email you sign in with and we will send you a link to set a new password."
      aside={aside}
    >
      <form onSubmit={submit} className="flex flex-col gap-6">
        <Field>
          <FieldLabel>Email</FieldLabel>
          <FieldControl
            render={<Input size="lg" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@yourbusiness.com"
            required
          />
        </Field>
        <Button type="submit" color="primary" size="lg" block loading={busy}>
          Send me a link
        </Button>
      </form>
    </AuthShell>
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
      //
      // ALL FOUR MEASURED ON SCREEN, 2026-09-25. Worth recording one result:
      // a too-short password does NOT burn the link. better-auth checks the
      // length BEFORE it looks the token up (dist/api/routes/password.mjs), and
      // deletes the token only after the password is stored — so being sent back
      // to think again costs a moment, never the link.
      const code = res.error.code;
      setError(
        code === 'PASSWORD_TOO_SHORT'
          ? 'That password is too short: please use at least 8 characters.'
          : code === 'PASSWORD_TOO_LONG'
            ? // 128 is ALLOWED — the check is `length > maxPasswordLength`, and
              // `maxPasswordLength` defaults to 128. This said "under 128",
              // which refuses a password the server would have taken.
              'That password is too long. Use 128 characters or fewer.'
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
        <FieldControl
          render={<PasswordInput size="lg" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
        />
        {/* THE RULE, BEFORE IT IS BROKEN. Both ends enforce eight characters and
            neither said so until somebody had already typed something shorter,
            which is a rule that only ever arrives as a refusal. It matters more
            here than on signup: this form is reached from an emailed link that
            expires, so being sent back to think again costs the link.

            Base UI's Field wires this to the input's `aria-describedby` ON THE
            CLIENT — the server HTML carries the text but not the association,
            which is graceful (`required` and `minlength` still reach a screen
            reader through the browser's own validation) and is why a reading
            taken on an unhydrated page says `null`. Issue 836 recorded such a
            reading as a silicaui defect; it was not one. */}
        <FieldDescription>At least 8 characters.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Type it once more</FieldLabel>
        <FieldControl
          render={<PasswordInput size="lg" />}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
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
