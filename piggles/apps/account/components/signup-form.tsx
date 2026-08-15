'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Field,
  FieldLabel,
  Input,
  PasswordInput,
} from '@wizeworks/silicaui-react';
import { PRODUCT } from '@piggles/config';
import { signUpAction, type SignUpState } from '@/app/signup/actions';
import { AuthDivider, GoogleButton } from './social-sign-in';

// Three fields, and one question that is not a field.
//
// The onboarding goal is a working business in under five minutes, and every
// field here is one the platform genuinely cannot proceed without. Notably
// ABSENT: the business name. `signUpMerchant` derives a placeholder workspace
// name and the person renames it in onboarding, where they have context for the
// question — asking "what is your business called?" before somebody has seen the
// product is asking them to commit to a decision in a form.
//
// ── THE CHECKBOX, WHICH IS HERE TO STOP A SCREEN EXISTING ───────────────────
//
// The console runs one optional tracker, and somebody has to be asked about it
// before they get there. The gate is /handoff — the single door from this domain
// into the console — and if it finds no answer on the account, it asks with a
// screen of its own. This box is how that screen never appears for anybody
// signing up with a password: the question is answered in passing, in the place
// they were already looking, and the door finds a record waiting.
//
// It is UNTICKED, and not by oversight. A pre-ticked consent box collects an
// agreement nobody made; leaving it alone is a complete and honest "no", and it
// is recorded as one so the person is not asked again.
//
// The Google path cannot carry it — that button leaves the site mid-form — so
// those signups meet the gate's screen instead. One question, two places it can
// be answered, one record.
//
// `size="lg"` on every control: 58px, inside Piggles' 56–60 comfort target. One
// decision, stated per form (DESIGN.md §5).

function Submit() {
  // `useFormStatus` reads the pending state of the enclosing <form>, which is
  // why this is its own component — a hook cannot see a form it is rendered
  // alongside rather than inside.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" color="primary" size="lg" block loading={pending}>
      {pending ? 'Creating your account' : 'Create my account'}
    </Button>
  );
}

export function SignUpForm({ from, google }: { from: string; google: boolean }) {
  const [state, action] = useActionState<SignUpState, FormData>(signUpAction, { error: null });
  // Google's failures arrive outside the server action, so they need their own
  // channel. One <Alert> renders whichever is set — two stacked error boxes for
  // two ways of failing at the same task is noise.
  const [socialError, setSocialError] = useState<string | null>(null);
  const error = socialError ?? state.error;

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-6">
        {/* The placement that sent them here, carried from the marketing link and
            captured first-party. Hidden because it is telemetry, not an answer. */}
        <input type="hidden" name="from" value={from} />

        {error ? (
          <Alert color="danger" variant="soft">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Field>
          <FieldLabel>Your name</FieldLabel>
          <Input name="name" size="lg" autoComplete="name" required />
        </Field>

        <Field>
          <FieldLabel>Email</FieldLabel>
          <Input
            name="email"
            size="lg"
            type="email"
            autoComplete="email"
            placeholder="you@yourbusiness.com"
            required
          />
        </Field>

        <Field>
          <FieldLabel>Password</FieldLabel>
          {/* A real password field with a reveal toggle, not a bare text input
              with `type="password"` — people mistype on phones and a blocked
              reveal is the single most common reason a signup is abandoned. */}
          <PasswordInput
            name="password"
            size="lg"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>

        {/* A label bound to a real checkbox, with the text as DIRECT children of
            a two-column grid — the same construction onboarding's choices use,
            for the same reason: the whole row is the hit target and the
            accessible name sits where a screen reader looks for it.
            `rounded-box` BY ROLE (18px, DESIGN.md §4) — this is a panel inside
            the card, so it takes the panel radius rather than a literal. */}
        <label
          htmlFor="analytics"
          className="border-base-300 bg-base-200 rounded-box grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-4 gap-y-1 border p-5"
        >
          <Checkbox id="analytics" name="analytics" color="primary" className="row-span-2 mt-0.5" />
          <span className="text-base font-bold">Help us fix what is confusing</span>
          <span className="text-base">
            Lets us see which screens get used inside {PRODUCT.name}. Never sold, never advertising,
            and never anything you have stored. You can change this any time from your account.
          </span>
        </label>

        <Submit />
      </form>

      {/* Outside the <form> on purpose. Google is a navigation away from this
          page, not a submission of it, and nesting a second way out inside the
          form is how a stray Enter key ends up leaving mid-typing. */}
      {google ? (
        <>
          <AuthDivider />
          <GoogleButton next="/" onError={setSocialError} />
        </>
      ) : null}
    </div>
  );
}
