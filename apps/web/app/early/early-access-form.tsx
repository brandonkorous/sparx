'use client';

// The /early waitlist form — name + email + "what are you building?". Posts to the
// joinWaitlist server action (React 19 form action), which calls the platform's
// public newsletter API. On success the whole form swaps for an inline
// confirmation, so "you're on the list" is shown without an email round-trip.

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Input, Label, Textarea } from '@sparx/ui';
import { Spark } from '@/components/marketing/primitives';
import { joinWaitlist, type WaitlistState } from './actions';

const INITIAL: WaitlistState = { status: 'idle' };

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '7px',
};

export function EarlyAccessForm() {
  const [state, action] = useActionState(joinWaitlist, INITIAL);

  if (state.status === 'success') {
    return <Confirmation email={state.email} />;
  }

  return (
    <form
      action={action}
      style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
      noValidate
    >
      <div style={fieldStyle}>
        <Label htmlFor="ea-name" style={labelStyle}>
          Name
        </Label>
        <Input
          id="ea-name"
          name="name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          maxLength={255}
        />
      </div>

      <div style={fieldStyle}>
        <Label htmlFor="ea-email" style={labelStyle}>
          Email
        </Label>
        <Input
          id="ea-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          maxLength={255}
        />
      </div>

      <div style={fieldStyle}>
        <Label htmlFor="ea-building" style={labelStyle}>
          What are you building?{' '}
          <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(optional)</span>
        </Label>
        <Textarea
          id="ea-building"
          name="building"
          rows={4}
          placeholder="A storefront, a content site, a CRM, a bit of everything…"
          maxLength={2000}
        />
      </div>

      {/* Honeypot — hidden from people, catnip for bots. */}
      <div aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}>
        <label htmlFor="ea-website">Website</label>
        <input id="ea-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === 'error' ? (
        <p
          role="alert"
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: 'var(--color-danger-text, #b91c1c)',
          }}
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton />

      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          lineHeight: '18px',
          color: 'var(--color-text-tertiary)',
        }}
      >
        No spam. One email when your invite is ready — and the occasional note on what shipped.
      </p>
    </form>
  );
}

function SubmitButton() {
  // useFormStatus reads the enclosing <form>'s pending state.
  const { pending } = useFormStatus();
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
          backgroundColor: 'var(--sparx-primary-tint, #EEF2FF)',
          color: 'var(--sparx-primary, #6366F1)',
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
          color: 'var(--color-text-primary)',
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
          color: 'var(--color-text-secondary)',
          maxWidth: '380px',
        }}
      >
        {email ? (
          <>
            We&rsquo;ve got <strong style={{ color: 'var(--color-text-primary)' }}>{email}</strong>.
            We&rsquo;ll reach out the moment your invite is ready.
          </>
        ) : (
          <>We&rsquo;ll reach out the moment your invite is ready.</>
        )}
      </p>
    </div>
  );
}
