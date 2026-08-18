'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, signUpMerchant, SignUpError } from '@wizeworks/auth';
import { normalizeEmail, PRODUCT } from '@piggles/config';
import { acquisitionFrom } from '@/lib/attribution';
import { writeConsent } from '@/lib/consent';
import { text } from '@/lib/form';

// Account creation for Piggles.
//
// Reuses the platform's `signUpMerchant`, which is the ONE place that knows a
// new account means: a tenant row, its primary site, an always-on subdomain,
// the owner user, the owner membership, the legal acceptance record, the trial
// clock and the welcome email. Piggles must not reimplement any of that — a
// second signup path is how the two products drift into having different ideas
// of what an account is (piggles/CLAUDE.md RULE #0).
//
// Piggles declares exactly two things the platform cannot infer:
//
//   • `platformBrand: 'piggles'` — which product this tenant signed up under.
//     Recorded once and never changed.
//   • `zoneDomain` — Piggles tenants get `<slug>.piggles.site`, not
//     `<slug>.sparx.zone`. It has to be an argument rather than the
//     `SPARX_ZONE_DOMAIN` env var the platform used to read, because both
//     brands are served by the SAME processes: an env var is fixed per
//     deployment and cannot vary per request, so every Piggles signup would
//     otherwise be handed a sparx address.
//
// Neither is a conditional. Nothing in the shared package branches on the value;
// the caller declares, provisioning records.
//
// ── WHAT IS DELIBERATELY *NOT* DONE HERE: TURNING MODULES ON ────────────────
//
// A tenant is born with none, under both brands. It is tempting to switch the
// whole catalogue on for Piggles right here — one plan, every app included — and
// it would be wrong twice over:
//
//   • A flag written straight into `settings` fires NOTHING. `module.activated`
//     is what seeds the CRM's pipeline, segments, SLA policies and object
//     registry, the automation seeds, commerce's tax and shipping defaults,
//     finance provisioning and the default emails. Writing the flag alone gets
//     you a business whose Customers app is "on" and has no pipeline in it.
//   • It answers a question nobody asked yet. The next screen asks what this
//     business actually does, and THAT answer decides what starts on — through
//     the real activation path, with the whole fan-out. See ../onboarding/actions.
//
// ── WHAT *IS* DONE HERE, AND WHY IT IS HERE RATHER THAN IN THE CONSOLE ──────
//
// The analytics consent decision. The console runs the one optional tracker
// Piggles has, and it used to ask for itself with a banner — which meant the
// answer was a cookie on mypiggles.com, and meant somebody reached their
// workspace before being asked. Neither is right: a customer deals with
// WizeWorks on getpiggles.com, so the question belongs on getpiggles.com, and
// the answer belongs on the account (lib/consent.ts) where all three surfaces
// can read it. Ticking the box here is what stops the ask from ever becoming a
// screen of its own for this person — an unticked box is a complete answer, and
// the handoff records it as one.

export interface SignUpState {
  error: string | null;
}

export async function signUpAction(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const name = text(formData, 'name');
  // Normalised, not merely trimmed — and the SAME call the sign-in form makes.
  // `text()` already trimmed, which was half the rule; the other half is case,
  // and half a normalisation is worse than none because it stores an address
  // that the other end will never construct. See @piggles/config's
  // normalize-email for the lockout this closes.
  const email = normalizeEmail(text(formData, 'email'));
  // NOT trimmed — a leading or trailing space is a legitimate part of a
  // password, and silently removing it locks the person out of the account they
  // just created.
  const rawPassword = formData.get('password');
  const password = typeof rawPassword === 'string' ? rawPassword : '';
  const from = text(formData, 'from');
  const attribution = text(formData, 'a');

  if (!name) return { error: 'Please tell us your name.' };
  if (!email.includes('@')) return { error: 'That does not look like an email address.' };
  // Better Auth enforces its own minimum server-side; stating it here means the
  // person is told before the round trip rather than after it.
  if (password.length < 8) return { error: 'Please use at least 8 characters for your password.' };

  // An unticked box is the answer "no" and is recorded as one. It is NOT
  // pre-ticked and never will be: consent that was not actively given is not
  // consent, and a default-on box is the single most common way a product
  // collects an agreement nobody made.
  const analytics = formData.get('analytics') === 'on';

  const h = await headers();

  let account: { userId: string; tenantId: string };
  try {
    account = await signUpMerchant({
      email,
      password,
      name,
      ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: h.get('user-agent'),
      acquisition: acquisitionFrom(from, attribution),
      platformBrand: 'piggles',
      zoneDomain: PRODUCT.tenantSites.suffix,
    });
  } catch (err) {
    if (err instanceof SignUpError) {
      // EMAIL_TAKEN is the one worth wording carefully: it confirms an address
      // has an account, which is unavoidable on a signup form (the alternative
      // is letting somebody believe they have signed up when they have not).
      // So it is stated plainly and paired with the way forward.
      if (err.code === 'EMAIL_TAKEN') {
        return { error: 'There is already an account with that email. Try signing in instead.' };
      }
      return { error: err.message };
    }
    // Anything else is ours, not theirs. Say so rather than showing a stack
    // trace's worth of nothing.
    return { error: 'Something went wrong at our end. Please try again in a moment.' };
  }

  // Best-effort, and the ONE thing in this file that is allowed to be. If this
  // write fails the account is still correct and nothing is being measured —
  // the record is simply absent, which reads as "never asked", so /handoff asks
  // on the next screen. Failing the signup over it would throw away a working
  // account to re-ask a question the person has already answered.
  try {
    await writeConsent(account.userId, account.tenantId, analytics);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        userId: account.userId,
        err: err instanceof Error ? err.message : String(err),
        msg: 'piggles signup: recording the analytics consent answer failed',
      })
    );
  }

  // Provisioning succeeded; now establish the session. Separate call on purpose
  // — `signUpMerchant` writes the rows and deliberately does not mint a session,
  // so the same function backs the OAuth path where Better Auth owns sign-in.
  try {
    await auth.api.signInEmail({ body: { email, password }, headers: h });
  } catch {
    // The account genuinely exists at this point, so sending them to sign in is
    // accurate and recoverable. Claiming failure would be a lie that makes them
    // try to sign up a second time and hit EMAIL_TAKEN on their own address.
    return { error: 'Your account was created, but signing you in failed. Please sign in.' };
  }

  // OUTSIDE every try/catch: `redirect()` works by throwing a control-flow
  // signal, so a `catch` around it swallows the navigation and the form appears
  // to do nothing at all.
  redirect('/onboarding');
}
