'use client';

// The internal bootcamp RSVP form — name + email + seats. Posts to the
// registerForBootcamp server action (React 19 form action). On success the form
// swaps for an inline confirmation whose copy reflects the decision: registered
// (seat held) or waitlisted (past capacity). Full bootcamps still show the form
// so people can join the waitlist.

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Input, Label, NativeSelect } from '@sparx/ui';
import { registerForBootcamp, type RsvpState } from './actions';

const INITIAL: RsvpState = { status: 'idle' };
const SANS = 'var(--font-sans)';
const PRIMARY = 'var(--sparx-primary)';

const labelStyle: React.CSSProperties = { fontFamily: SANS, fontSize: '13px', fontWeight: 500 };
const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '7px' };

export function RsvpForm({ slug, full }: { slug: string; full: boolean }) {
  const [state, action] = useActionState(registerForBootcamp, INITIAL);

  if (state.status === 'registered' || state.status === 'waitlisted') {
    return <Confirmation waitlisted={state.status === 'waitlisted'} />;
  }

  return (
    <form
      action={action}
      style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
      noValidate
    >
      <input type="hidden" name="slug" value={slug} />
      <div style={fieldStyle}>
        <Label htmlFor="rsvp-name" style={labelStyle}>
          Name
        </Label>
        <Input
          id="rsvp-name"
          name="name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          required
          maxLength={255}
        />
      </div>
      <div style={fieldStyle}>
        <Label htmlFor="rsvp-email" style={labelStyle}>
          Email
        </Label>
        <Input
          id="rsvp-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@email.com"
          maxLength={255}
        />
      </div>
      <div style={fieldStyle}>
        <Label htmlFor="rsvp-seats" style={labelStyle}>
          Seats
        </Label>
        <NativeSelect id="rsvp-seats" name="seats" defaultValue="1">
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'seat' : 'seats'}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* Honeypot */}
      <div aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}>
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
        <p
          role="alert"
          style={{
            margin: 0,
            fontFamily: SANS,
            fontSize: '13px',
            color: 'var(--color-danger-text)',
          }}
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton full={full} />
      <p
        style={{
          margin: 0,
          fontFamily: SANS,
          fontSize: '12px',
          lineHeight: '18px',
          color: 'var(--color-text-tertiary)',
        }}
      >
        Your details go to the hosting partner, who follows up with the specifics.
      </p>
    </form>
  );
}

function SubmitButton({ full }: { full: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" color="primary" size="lg" disabled={pending} style={{ width: '100%' }}>
      {pending ? 'Reserving…' : full ? 'Join the waitlist →' : 'Reserve your seat →'}
    </Button>
  );
}

function Confirmation({ waitlisted }: { waitlisted: boolean }) {
  return (
    <div
      role="status"
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'flex-start' }}
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
          backgroundColor: 'var(--sparx-primary-tint)',
          color: PRIMARY,
          fontSize: 22,
        }}
      >
        ✓
      </span>
      <span
        style={{ fontFamily: SANS, fontWeight: 500, fontSize: '22px', letterSpacing: '-0.02em' }}
      >
        {waitlisted ? 'You’re on the waitlist' : 'Your seat is reserved'}
        <span style={{ color: PRIMARY }}>.</span>
      </span>
      <p
        style={{
          margin: 0,
          fontFamily: SANS,
          fontSize: '15px',
          lineHeight: '24px',
          color: 'var(--color-text-secondary)',
          maxWidth: '320px',
        }}
      >
        {waitlisted
          ? 'This bootcamp is full — we’ll let you know the moment a seat opens up.'
          : 'The hosting partner has your details and will be in touch with everything you need.'}
      </p>
    </div>
  );
}
