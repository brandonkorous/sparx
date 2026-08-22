'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  Input,
  PasswordInput,
} from '@wizeworks/silicaui-react';
import { signIn, twoFactor } from '@wizeworks/auth/client';
import { normalizeEmail, PRODUCT } from '@piggles/config';
import { AuthDivider, GoogleButton } from './social-sign-in';

// Sign in.
//
// ── TWO-STEP IS HANDLED IN PLACE ────────────────────────────────────────────
//
// The platform's Better Auth is configured with the twoFactor plugin and
// deliberately WITHOUT `twoFactorPage` / `onTwoFactorRedirect`, both of which
// hijack the browser on the app's behalf — `twoFactorPage` with a full page load
// that throws away the half-filled card. Without them, `signIn.email` simply
// answers `{ twoFactorRedirect: true }` and the caller swaps to its own step.
// That is what `step` below is: same card, second question, nothing navigated.
//
// Getting this wrong is not a cosmetic bug. A person with two-step turned on who
// is bounced to a blank page mid-sign-in has no way to tell a broken login from
// a phishing redirect, and the correct response to that ambiguity is to stop.
//
// ── SIZE lg, ONCE PER FORM ──────────────────────────────────────────────────
//
// `--size-field: 0.3rem` puts silica's default control at 48px and `lg` at 58 —
// inside the 56–60 comfort target Piggles builds forms to (DESIGN.md §5). So a
// form Piggles owns says `lg` and nothing else says anything about size. That is
// what the prop is for; the rule that bans call-site patching is about SHARED
// code, and one decision repeated four times inside one form is still one
// decision.

type Step = 'credentials' | 'two-factor';

/**
 * Go to where sign-in was headed, with a REAL browser navigation.
 *
 * ── WHY NOT `router.push` ───────────────────────────────────────────────────
 *
 * `next` is usually `/handoff`, which is not a page — it is the one door out of
 * getpiggles.com, and it answers 303 to an address on ANOTHER ORIGIN. Next's
 * client router does not navigate to a string, it fetches the RSC payload for
 * it first; that fetch follows the 303 cross-origin, CORS refuses it, and the
 * router logs
 *
 *     Failed to fetch RSC payload for …/handoff?next=%2F.
 *     Falling back to browser navigation. TypeError: Failed to fetch
 *
 * before doing the navigation it should have done in the first place.
 *
 * The log is the harmless half. The damage is that `/handoff` gets hit TWICE —
 * once by the doomed fetch and once by the fallback — and it MINTS A SINGLE-USE
 * TOKEN. The server log shows it exactly: `GET /handoff 303` then `GET /handoff
 * 307`, the second landing back on /sign-in. A route that can only be called
 * once must never be reachable by a mechanism that calls it twice.
 *
 * ── AND IT IS THE RIGHT THING EVEN WHEN `next` STAYS LOCAL ──────────────────
 *
 * A session was just created. Every cached RSC payload in the client router was
 * built by a signed-OUT visitor, so a soft navigation carries that cache across
 * the authentication boundary and `router.refresh()` is an attempt to patch it
 * afterwards. A document load throws it away, which is what actually wanted to
 * happen.
 */
function leaveFor(next: string): void {
  window.location.assign(next);
}

export function SignInForm({ next, google }: { next: string; google: boolean }) {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  // Default ON. Almost nobody signing into their own business software on their
  // own machine wants a session that dies with the tab, and the people who do
  // are the ones who will look for this control. Defaulting it off would make
  // the common case worse to protect the rare one.
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentLink, setSentLink] = useState(false);

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // The address is normalised with the SAME function signup used to store it.
    // Without that, an address carrying a stray space or a capital — autofill,
    // a paste, a phone keyboard capitalising the first letter — creates the
    // account under one string and looks it up under another, and the only
    // feedback is "that email and password do not match an account" while the
    // person stares at the correct address and the correct password.
    //
    // The PASSWORD is passed through untouched, deliberately: a leading or
    // trailing space is a legitimate part of one.
    const res = await signIn.email({
      email: normalizeEmail(email),
      password,
      rememberMe: remember,
    });
    setBusy(false);

    if (res.error) {
      // ── THE AMBIGUITY IS FOR CREDENTIALS ONLY ──────────────────────────────
      //
      // "No such account" and "wrong password" stay indistinguishable on
      // purpose: which one it was is exactly what somebody probing for valid
      // addresses wants to learn, and it helps a real person not at all — they
      // already know whether they have an account.
      //
      // That reasoning covers ONE failure and this branch used to swallow every
      // other one with it. It hid a `BETTER_AUTH_URL` misconfiguration for
      // hours: the app was answering "Invalid origin" to every browser sign-in,
      // and the screen said the password was wrong. The person had the right
      // password. Nothing in typecheck, lint or a curl probe can see it —
      // sign-up runs in a server action and curl sends no Origin header, so
      // both keep working while the browser is refused.
      //
      // So: an error that is NOT about credentials is reported as itself. There
      // is nothing to protect by hiding a server misconfiguration behind a lie
      // about the password — an attacker learns nothing from "the sign-in
      // service is misconfigured", and the person who has to fix it learns
      // everything.
      // Keyed off the CODE, not the status. The first version of this checked
      // `status === 401 || status === 403` — and 403 is precisely what an
      // invalid origin returns, so it would have re-hidden the bug it was
      // written to expose. `INVALID_EMAIL_OR_PASSWORD` is the one failure the
      // ambiguity is for; 401 is kept as a fallback for a credential error
      // arriving under a code this does not know.
      const code = res.error.code;
      const credentialFailure =
        code === 'INVALID_EMAIL_OR_PASSWORD' || (code === undefined && res.error.status === 401);
      setError(
        credentialFailure
          ? 'That email and password do not match an account.'
          : `Sign-in is not working right now — ${res.error.message ?? 'the server refused the request'}. This is our problem, not yours.`
      );
      return;
    }
    if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      setStep('two-factor');
      return;
    }
    leaveFor(next);
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // A backup code is longer than a TOTP code and is the thing people reach for
    // when their phone is the problem. Accepting either from one field means
    // nobody has to work out which box their code belongs in while locked out.
    const res =
      code.trim().length > 6
        ? await twoFactor.verifyBackupCode({ code: code.trim() })
        : await twoFactor.verifyTotp({ code: code.trim() });
    setBusy(false);

    if (res.error) {
      setError('That code was not right. Codes change every 30 seconds — try the current one.');
      return;
    }
    leaveFor(next);
  }

  async function sendMagicLink() {
    if (!email.includes('@')) {
      setError('Enter your email address first and we will send you a link.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await signIn.magicLink({ email: normalizeEmail(email), callbackURL: next });
    setBusy(false);
    if (res.error) {
      setError('We could not send that link. Please try again in a moment.');
      return;
    }
    setSentLink(true);
  }

  if (sentLink) {
    return (
      <Alert color="success" variant="soft">
        <AlertDescription>
          Check your email — we have sent a link that signs you straight in. It is good for the next
          few minutes.
        </AlertDescription>
      </Alert>
    );
  }

  if (step === 'two-factor') {
    return (
      <form onSubmit={submitCode} className="flex flex-col gap-6">
        {error ? (
          <Alert color="danger" variant="soft">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* The card's h1 still says "Welcome back", which is true — they are
            mid-sign-in, not somewhere else. This names the step under it so the
            screen is not silently a different question than its heading. */}
        <div>
          <h2 className="text-xl font-bold">One more step.</h2>
          <p className="mt-1 text-base">
            From your authenticator app. If you cannot reach it, one of your backup codes works here
            too.
          </p>
        </div>

        <Field>
          <FieldLabel>Your six-digit code</FieldLabel>
          <FieldControl
            render={<Input size="lg" />}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
        </Field>

        <Button type="submit" color="primary" size="lg" block loading={busy}>
          Confirm and sign in
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitCredentials} className="flex flex-col gap-6">
      {error ? (
        <Alert color="danger" variant="soft">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Field>
        <FieldLabel>Email</FieldLabel>
        <FieldControl
          render={<Input size="lg" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          placeholder="you@yourbusiness.com"
          required
        />
      </Field>

      <Field>
        <FieldLabel>Password</FieldLabel>
        <FieldControl
          render={<PasswordInput size="lg" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </Field>

      {/* The two controls that belong to the password field, on its own line:
          how long the session lasts, and the way out of not knowing it. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Checkbox
          color="primary"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        >
          <span className="text-base">Keep me signed in</span>
        </Checkbox>
        <Link href="/forgot-password" className="text-primary text-base font-semibold">
          Forgot your password?
        </Link>
      </div>

      <Button type="submit" color="primary" size="lg" block loading={busy}>
        Sign in to {PRODUCT.name}
      </Button>

      <AuthDivider />

      {/* The other ways in, together, after the rule. Google first where it is
          configured — it is one tap and needs nothing remembered. The emailed
          link is the answer for somebody whose password is the problem but who
          does not want to choose a new one under pressure. */}
      <div className="flex flex-col gap-3">
        {google ? <GoogleButton next={next} onError={setError} disabled={busy} /> : null}

        <Button
          type="button"
          color="neutral"
          variant="outline"
          size="lg"
          block
          onClick={sendMagicLink}
          disabled={busy}
        >
          Email me a link instead
        </Button>
      </div>
    </form>
  );
}
