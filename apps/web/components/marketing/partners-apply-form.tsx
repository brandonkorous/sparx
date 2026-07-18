'use client';

// The /partners application form — name + email + website/LinkedIn + "what
// describes you" + how you'll use sparx + the tier you're applying for. Posts to
// the applyToPartnerProgram server action (React 19 form action). On success the
// form swaps for an inline confirmation: EVERY application is reviewed by the Sparx
// team within 3 business days — no tier activates automatically.

import { useActionState, useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, rules, useFieldValidation } from '@sparx/forms';
import { type PartnerTier } from '@/lib/partners';
import { applyToPartnerProgram, type ApplyState } from '@/app/partners/actions';
import { Spark } from './primitives';

const INITIAL: ApplyState = { status: 'idle' };
const SANS = 'var(--font-sans)';
const EMBER = 'var(--color-primary)';
const EMBER_TINT = 'color-mix(in oklab, var(--color-primary) 15%, var(--color-base-100))';
const EMBER_TEXT = 'var(--color-primary)';

const TIERS: { value: PartnerTier; label: string }[] = [
  { value: 'informal', label: 'Informal' },
  { value: 'registered', label: 'Registered' },
  { value: 'certified', label: 'Certified' },
];

const labelStyle: React.CSSProperties = { fontFamily: SANS, fontSize: '13px', fontWeight: 500 };

export function PartnersApplyForm() {
  const [state, action, pending] = useActionState(applyToPartnerProgram, INITIAL);
  const [tier, setTier] = useState<PartnerTier>('informal');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const v = useFieldValidation(
    { name, email },
    {
      name: rule.required('Enter your name.'),
      email: rules(rule.required('Enter your email.'), rule.email()),
    }
  );

  if (state.status === 'pending') {
    return <Confirmation />;
  }

  // Gate the server action on client validation; only dispatch when valid.
  function clientAction(formData: FormData) {
    if (!v.validate()) return;
    action(formData);
  }

  return (
    <form
      action={clientAction}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      noValidate
    >
      <Field {...v.field('name')}>
        <FieldLabel required style={labelStyle}>
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
        <FieldLabel required style={labelStyle}>
          Email
        </FieldLabel>
        <FieldControl
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@studio.com"
          maxLength={255}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...v.control('email')}
        />
      </Field>

      <Field>
        <FieldLabel style={labelStyle}>
          Website or LinkedIn{' '}
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
          name="websiteUrl"
          autoComplete="url"
          placeholder="studio.com"
          maxLength={500}
        />
      </Field>

      <Field>
        <FieldLabel style={labelStyle}>What best describes you?</FieldLabel>
        <FieldControl
          render={
            <NativeSelect name="kind" defaultValue="freelance">
              <option value="freelance">Freelance consultant</option>
              <option value="agency">Agency</option>
              <option value="developer">Developer</option>
              <option value="other">Other</option>
            </NativeSelect>
          }
        />
      </Field>

      <Field>
        <FieldLabel style={labelStyle}>How will you use sparx with clients?</FieldLabel>
        <FieldControl
          render={
            <Textarea name="note" rows={3} placeholder="Two or three sentences…" maxLength={2000} />
          }
        />
      </Field>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <span style={labelStyle}>Tier you&rsquo;re applying for</span>
        <input type="hidden" name="requestedTier" value={tier} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {TIERS.map((t) => {
            const on = tier === t.value;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={on}
                onClick={() => setTier(t.value)}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: `1px solid ${on ? EMBER : 'var(--color-base-300)'}`,
                  backgroundColor: on ? EMBER_TINT : 'var(--color-base-100)',
                  color: on
                    ? EMBER_TEXT
                    : 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                  fontFamily: SANS,
                  fontSize: '13px',
                  fontWeight: on ? 500 : 400,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <span
          style={{
            fontFamily: SANS,
            fontSize: '12px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            lineHeight: '17px',
          }}
        >
          {tier === 'informal'
            ? 'Approved instantly — activate right after you apply.'
            : 'Reviewed within 3 business days.'}
        </span>
      </div>

      {/* Honeypot — hidden from people, catnip for bots. */}
      <div aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}>
        <label htmlFor="pa-company-url">Company URL</label>
        <input
          id="pa-company-url"
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

      <SubmitButton pending={pending} />
    </form>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" size="lg" disabled={pending} style={{ width: '100%' }}>
      {pending ? 'Submitting…' : 'Submit application →'}
    </Button>
  );
}

function Confirmation() {
  return (
    <div
      role="status"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}
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
          backgroundColor: EMBER_TINT,
          color: EMBER,
          fontSize: 22,
        }}
      >
        ✓
      </span>
      <span
        style={{ fontFamily: SANS, fontWeight: 500, fontSize: '24px', letterSpacing: '-0.02em' }}
      >
        Application received
        <Spark />
      </span>
      <p
        style={{
          margin: 0,
          fontFamily: SANS,
          fontSize: '15px',
          lineHeight: '24px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          maxWidth: '380px',
        }}
      >
        Every application is reviewed by the Sparx team — we’ll be in touch within 3 business days.
      </p>
    </div>
  );
}
