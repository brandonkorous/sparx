'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  PasswordInput,
} from '@wizeworks/silicaui-react';
import { marketingUrl, PRODUCT } from '@piggles/config';
import { signUpAction, type SignUpState } from '@/app/signup/actions';
import { googleReturnPath } from '@/lib/signup-source';
import { AuthDivider, GoogleButton } from './social-sign-in';

// Three fields and one consent box. No business name: setup asks it, once the
// person has context. The box is UNTICKED (a pre-ticked box is an agreement nobody
// made), and the page says so whenever a marketing source rides along with it.

function Submit() {
  // Its own component: `useFormStatus` only sees a form it is rendered INSIDE.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" color="primary" size="lg" block loading={pending}>
      {pending ? 'Creating your account' : 'Create my account'}
    </Button>
  );
}

export function SignUpForm({
  from,
  attribution,
  next,
  google,
}: {
  from: string;
  attribution: string;
  /** Where to land once the account exists. Usually `/onboarding`; an
   *  invitation link sends them back to the invitation instead. */
  next: string;
  google: boolean;
}) {
  const [state, action] = useActionState<SignUpState, FormData>(signUpAction, { error: null });
  // Google fails outside the server action; one <Alert> shows whichever failed.
  const [socialError, setSocialError] = useState<string | null>(null);
  const error = socialError ?? state.error;

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-6">
        {/* The button that sent them, and (with permission) the campaign before it. */}
        <input type="hidden" name="from" value={from} />
        <input type="hidden" name="a" value={attribution} />
        {/* The action navigates, so it must be told where to. */}
        <input type="hidden" name="next" value={next} />

        {error ? (
          <Alert color="danger" variant="soft">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Field>
          <FieldLabel>Your name</FieldLabel>
          {/* Through FieldControl, or the label points at nothing (issue #006). */}
          <FieldControl render={<Input size="lg" />} name="name" autoComplete="name" required />
        </Field>

        <Field>
          <FieldLabel>Email</FieldLabel>
          <FieldControl
            render={<Input size="lg" />}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@yourbusiness.com"
            required
          />
        </Field>

        <Field>
          <FieldLabel>Password</FieldLabel>
          {/* With a reveal toggle: a mistyped phone password is why signups are abandoned. */}
          <FieldControl
            render={<PasswordInput size="lg" />}
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
          {/* The rule stated before it is broken, not only as a refusal. */}
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>

        {/* The whole row is the hit target and the accessible name. `rounded-box`
            by role: a panel inside the card (DESIGN.md §4). */}
        <label
          htmlFor="analytics"
          className="border-base-300 bg-base-200 rounded-box grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-4 gap-y-1 border p-5"
        >
          <Checkbox id="analytics" name="analytics" color="primary" className="row-span-2 mt-0.5" />
          <span className="text-base font-bold">Help us fix what is confusing</span>
          {/* Scoped to the workspace tracker only: the hidden source above can name an advert. */}
          <span className="text-base">
            This one is about the workspace: which screens get used inside {PRODUCT.name}, so we can
            find the confusing ones. Never sold, never used to advertise to you, and never anything
            you have stored in it. You can change it any time from your account.
          </span>
        </label>

        {/* Only when a source came with them: told on the page that records it. */}
        {attribution ? (
          <p className="text-base">
            You came here from a link that told us where you found us, because you agreed to that on{' '}
            {PRODUCT.hosts.marketing}. It is kept with your account so we know what is worth doing
            more of, and it is listed in full on{' '}
            <a className="font-semibold underline" href={marketingUrl('cookies')}>
              cookies
            </a>
            .
          </p>
        ) : null}

        <Submit />
      </form>

      {/* Outside the <form>: Google is a navigation, and a stray Enter must not leave. */}
      {google ? (
        <>
          <AuthDivider />
          {/* To setup (never `/`, which skips it), carrying the source along. */}
          <GoogleButton next={googleReturnPath(next, from, attribution)} onError={setSocialError} />
        </>
      ) : null}
    </div>
  );
}
