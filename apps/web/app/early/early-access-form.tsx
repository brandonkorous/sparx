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

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--color-base-content)',
};

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
    <form
      action={clientAction}
      style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
      noValidate
    >
      <Field>
        <FieldLabel style={labelStyle}>Name</FieldLabel>
        <FieldControl name="name" autoComplete="name" placeholder="Ada Lovelace" maxLength={255} />
      </Field>

      <Field {...v.field('email')}>
        <FieldLabel required style={labelStyle}>
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
        <FieldLabel style={labelStyle}>
          What are you building?{' '}
          <span
            style={{
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              fontWeight: 400,
            }}
          >
            (optional)
          </span>
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
      <div aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}>
        <label htmlFor="ea-website">Website</label>
        <input id="ea-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === 'error' ? (
        <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
          {state.message}
        </FieldStatus>
      ) : null}

      <SubmitButton pending={pending} />

      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          lineHeight: '18px',
          color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
        }}
      >
        No spam. One email when your invite is ready — and the occasional note on what shipped.
      </p>
    </form>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" size="lg" disabled={pending} style={{ width: '100%' }}>
      {pending ? 'Joining…' : 'Join the waitlist →'}
    </Button>
  );
}

function Confirmation({ email }: { email?: string }) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        alignItems: 'flex-start',
        paddingTop: '8px',
        paddingBottom: '8px',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          borderRadius: 9999,
          backgroundColor: 'color-mix(in oklab, var(--color-primary) 15%, var(--color-base-100))',
          color: 'var(--color-primary, #6366F1)',
          fontSize: 22,
        }}
      >
        ✓
      </span>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '24px',
          letterSpacing: '-0.02em',
          color: 'var(--color-base-content)',
        }}
      >
        You&rsquo;re on the list
        <Spark />
      </span>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: '15px',
          lineHeight: '24px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          maxWidth: '380px',
        }}
      >
        {email ? (
          <>
            We&rsquo;ve got <strong style={{ color: 'var(--color-base-content)' }}>{email}</strong>.
            We&rsquo;ll reach out the moment your invite is ready.
          </>
        ) : (
          <>We&rsquo;ll reach out the moment your invite is ready.</>
        )}
      </p>
    </div>
  );
}
