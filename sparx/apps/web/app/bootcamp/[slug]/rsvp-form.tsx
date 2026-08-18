'use client';

// The internal bootcamp RSVP form — name + email + seats. Posts to the
// registerForBootcamp server action (React 19 form action). On success the form
// swaps for an inline confirmation whose copy reflects the decision: registered
// (seat held) or waitlisted (past capacity). Full bootcamps still show the form
// so people can join the waitlist.

import { useActionState, useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { rule, rules, useFieldValidation } from '@wizeworks/forms';
import { registerForBootcamp, type RsvpState } from './actions';

const INITIAL: RsvpState = { status: 'idle' };

const LABEL_CLASS = 'text-sm font-medium';

export function RsvpForm({ slug, full }: { slug: string; full: boolean }) {
  const [state, action, pending] = useActionState(registerForBootcamp, INITIAL);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const v = useFieldValidation(
    { name, email },
    {
      name: rule.required('Enter your name.'),
      email: rules(rule.required('Enter your email.'), rule.email()),
    }
  );

  if (state.status === 'registered' || state.status === 'waitlisted') {
    return <Confirmation waitlisted={state.status === 'waitlisted'} />;
  }

  // Gate the server action on client validation; only dispatch when valid.
  function clientAction(formData: FormData) {
    if (!v.validate()) return;
    action(formData);
  }

  return (
    <form action={clientAction} className="flex flex-col gap-3.5" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <Field {...v.field('name')}>
        <FieldLabel required className={LABEL_CLASS}>
          Name
        </FieldLabel>
        <FieldControl
          name="name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          maxLength={255}
          value={name}
          onChange={(e) => setName(e.target.value)}
          {...v.control('name')}
        />
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
          placeholder="you@email.com"
          maxLength={255}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...v.control('email')}
        />
      </Field>
      <Field>
        <FieldLabel className={LABEL_CLASS}>Seats</FieldLabel>
        <FieldControl
          render={
            <NativeSelect name="seats" defaultValue="1">
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'seat' : 'seats'}
                </option>
              ))}
            </NativeSelect>
          }
        />
      </Field>

      {/* Honeypot */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px">
        <label htmlFor="rsvp-company-url">Company URL</label>
        <input
          id="rsvp-company-url"
          name="company_url"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {state.status === 'error' ? (
        <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
          {state.message}
        </FieldStatus>
      ) : null}

      <SubmitButton full={full} pending={pending} />
      <p className="m-0 text-sm">
        Your details go to the hosting partner, who follows up with the specifics.
      </p>
    </form>
  );
}

function SubmitButton({ full, pending }: { full: boolean; pending: boolean }) {
  return (
    <Button type="submit" color="primary" size="lg" block disabled={pending}>
      {pending ? 'Reserving…' : full ? 'Join the waitlist →' : 'Reserve your seat →'}
    </Button>
  );
}

function Confirmation({ waitlisted }: { waitlisted: boolean }) {
  return (
    <div role="status" className="flex flex-col items-start gap-3.5">
      <span
        aria-hidden
        className="bg-primary bg-soft text-primary inline-flex h-11 w-11 items-center justify-center rounded-full text-2xl"
      >
        ✓
      </span>
      <span className="text-2xl font-medium tracking-[-0.02em]">
        {waitlisted ? 'You’re on the waitlist' : 'Your seat is reserved'}
        <span className="text-primary">.</span>
      </span>
      <p className="text-md m-0 max-w-[320px]">
        {waitlisted
          ? 'This bootcamp is full — we’ll let you know the moment a seat opens up.'
          : 'The hosting partner has your details and will be in touch with everything you need.'}
      </p>
    </div>
  );
}
