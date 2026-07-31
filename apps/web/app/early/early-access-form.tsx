'use client';

// The /early waitlist form — name + email + "what are you building?". Posts to the
// joinWaitlist server action (React 19 form action), which calls the platform's
// public newsletter API. On success the whole form swaps for an inline
// confirmation, so "you're on the list" is shown without an email round-trip.

import { useActionState, useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, rules, useFieldValidation } from '@sparx/forms';
import { Spark } from '@/components/marketing/primitives';
import { joinWaitlist, type WaitlistState } from './actions';

const INITIAL: WaitlistState = { status: 'idle' };

const LABEL_CLASS = 'text-caption font-medium';
const OPTIONAL_CLASS = 'text-ink-subtle font-normal';

export function EarlyAccessForm() {
  const [state, action, pending] = useActionState(joinWaitlist, INITIAL);
  const [email, setEmail] = useState('');

  const v = useFieldValidation(
    { email },
    { email: rules(rule.required('Enter your email.'), rule.email()) }
  );

  if (state.status === 'success') {
    return <Confirmation email={state.email} />;
  }

  // Gate the server action on client validation; only dispatch when valid.
  function clientAction(formData: FormData) {
    if (!v.validate()) return;
    action(formData);
  }

  return (
    <form action={clientAction} className="flex flex-col gap-[18px]" noValidate>
      <Field>
        <FieldLabel className={LABEL_CLASS}>Name</FieldLabel>
        <FieldControl name="name" autoComplete="name" placeholder="Ada Lovelace" maxLength={255} />
      </Field>

      <Field {...v.field('email')}>
        <FieldLabel required className={LABEL_CLASS}>
          Email
        </FieldLabel>
        <FieldControl
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          maxLength={255}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...v.control('email')}
        />
      </Field>

      <Field>
        <FieldLabel className={LABEL_CLASS}>
          What are you building? <span className={OPTIONAL_CLASS}>(optional)</span>
        </FieldLabel>
        <FieldControl
          render={
            <Textarea
              name="building"
              rows={4}
              placeholder="A storefront, a content site, a CRM, a bit of everything…"
              maxLength={2000}
            />
          }
        />
      </Field>

      {/* Honeypot — hidden from people, catnip for bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-px w-px">
        <label htmlFor="ea-website">Website</label>
        <input id="ea-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === 'error' ? (
        <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
          {state.message}
        </FieldStatus>
      ) : null}

      <SubmitButton pending={pending} />

      <p className="text-mini text-ink-subtle m-0">
        No spam. One email when your invite is ready — and the occasional note on what shipped.
      </p>
    </form>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Joining…' : 'Join the waitlist →'}
    </Button>
  );
}

function Confirmation({ email }: { email?: string }) {
  return (
    <div role="status" className="flex flex-col items-start gap-3.5 py-2">
      <span
        aria-hidden
        className="bg-primary bg-soft text-primary text-h3 inline-flex h-11 w-11 items-center justify-center rounded-full"
      >
        ✓
      </span>
      <span className="text-h2 font-medium tracking-[-0.02em]">
        You&rsquo;re on the list
        <Spark />
      </span>
      <p className="text-body-sm text-ink-muted m-0 max-w-[380px]">
        {email ? (
          <>
            We&rsquo;ve got <strong>{email}</strong>. We&rsquo;ll reach out the moment your invite
            is ready.
          </>
        ) : (
          <>We&rsquo;ll reach out the moment your invite is ready.</>
        )}
      </p>
    </div>
  );
}
