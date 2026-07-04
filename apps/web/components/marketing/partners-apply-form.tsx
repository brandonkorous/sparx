'use client';

// The /partners application form — name + email + website/LinkedIn + "what
// describes you" + how you'll use sparx + the tier you're applying for. Posts to
// the applyToPartnerProgram server action (React 19 form action). On success the
// form swaps for an inline confirmation: EVERY application is reviewed by the Sparx
// team within 3 business days — no tier activates automatically.

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Input, Label, NativeSelect, Textarea } from '@sparx/ui';
import { type PartnerTier } from '@/lib/partners';
import { applyToPartnerProgram, type ApplyState } from '@/app/partners/actions';
import { Spark } from './primitives';

const INITIAL: ApplyState = { status: 'idle' };
const SANS = 'var(--font-sans)';
const INDIGO = 'var(--sparx-primary)';
const INDIGO_TINT = 'var(--sparx-primary-tint)';
const INDIGO_TEXT = 'var(--sparx-primary-hover)';

const TIERS: { value: PartnerTier; label: string }[] = [
  { value: 'informal', label: 'Informal' },
  { value: 'registered', label: 'Registered' },
  { value: 'certified', label: 'Certified' },
];

const labelStyle: React.CSSProperties = { fontFamily: SANS, fontSize: '13px', fontWeight: 500 };
const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '7px' };

export function PartnersApplyForm() {
  const [state, action] = useActionState(applyToPartnerProgram, INITIAL);
  const [tier, setTier] = useState<PartnerTier>('informal');

  if (state.status === 'pending') {
    return <Confirmation />;
  }

  return (
    <form
      action={action}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      noValidate
    >
      <div style={fieldStyle}>
        <Label htmlFor="pa-name" style={labelStyle}>
          Name
        </Label>
        <Input
          id="pa-name"
          name="name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          required
          maxLength={255}
        />
      </div>

      <div style={fieldStyle}>
        <Label htmlFor="pa-email" style={labelStyle}>
          Email
        </Label>
        <Input
          id="pa-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@studio.com"
          maxLength={255}
        />
      </div>

      <div style={fieldStyle}>
        <Label htmlFor="pa-web" style={labelStyle}>
          Website or LinkedIn{' '}
          <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(optional)</span>
        </Label>
        <Input
          id="pa-web"
          name="websiteUrl"
          autoComplete="url"
          placeholder="studio.com"
          maxLength={500}
        />
      </div>

      <div style={fieldStyle}>
        <Label htmlFor="pa-kind" style={labelStyle}>
          What best describes you?
        </Label>
        <NativeSelect id="pa-kind" name="kind" defaultValue="freelance">
          <option value="freelance">Freelance consultant</option>
          <option value="agency">Agency</option>
          <option value="developer">Developer</option>
          <option value="other">Other</option>
        </NativeSelect>
      </div>

      <div style={fieldStyle}>
        <Label htmlFor="pa-note" style={labelStyle}>
          How will you use sparx with clients?
        </Label>
        <Textarea
          id="pa-note"
          name="note"
          rows={3}
          placeholder="Two or three sentences…"
          maxLength={2000}
        />
      </div>

      <div style={fieldStyle}>
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
                  border: `1px solid ${on ? INDIGO : 'var(--color-border-default)'}`,
                  backgroundColor: on ? INDIGO_TINT : 'var(--color-bg-surface)',
                  color: on ? INDIGO_TEXT : 'var(--color-text-secondary)',
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
            color: 'var(--color-text-tertiary)',
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

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
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
          backgroundColor: INDIGO_TINT,
          color: INDIGO,
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
          color: 'var(--color-text-secondary)',
          maxWidth: '380px',
        }}
      >
        Every application is reviewed by the Sparx team — we’ll be in touch within 3 business days.
      </p>
    </div>
  );
}
