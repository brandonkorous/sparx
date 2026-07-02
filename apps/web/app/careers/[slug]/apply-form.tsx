'use client';

// The /careers/[slug] application form. Posts to the submitApplication server
// action (React 19 form action), which forwards to the platform's public careers
// API and uploads the résumé PDF. On success the whole form swaps for an inline
// confirmation. Mirrors the /early waitlist form's structure (useActionState +
// useFormStatus SubmitButton + honeypot + inline-CSS-var field styling).

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Input, Label, Textarea } from '@sparx/ui';
import { Spark } from '@/components/marketing/primitives';
import { submitApplication, type ApplicationState } from '../actions';

const INITIAL: ApplicationState = { status: 'idle' };

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
};

const optionalStyle: React.CSSProperties = {
  color: 'var(--color-text-tertiary)',
  fontWeight: 400,
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '7px',
};

const hintStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '12px',
  color: 'var(--color-text-tertiary)',
};

export interface ApplyFormRole {
  slug: string;
  title: string;
  resumeRequired: boolean;
  interestPrompt?: string;
}

type TextFieldProps = { label: string; optional?: boolean } & React.ComponentProps<typeof Input>;

function TextField({ label, optional, ...input }: TextFieldProps) {
  return (
    <div style={fieldStyle}>
      <Label htmlFor={input.id} style={labelStyle}>
        {label}
        {optional ? <span style={optionalStyle}> (optional)</span> : null}
      </Label>
      <Input {...input} />
    </div>
  );
}

export function ApplyForm({ role }: { role: ApplyFormRole }) {
  const [state, action] = useActionState(submitApplication, INITIAL);

  if (state.status === 'success') {
    return <Confirmation />;
  }

  return (
    <form
      action={action}
      style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
      noValidate
    >
      {/* Carries the role identity to the server action. */}
      <input type="hidden" name="roleSlug" value={role.slug} />
      <input type="hidden" name="roleTitle" value={role.title} />

      <div className="mkt-grid-2-1">
        <TextField
          id="ap-name"
          name="fullName"
          label="Full name"
          autoComplete="name"
          required
          placeholder="Ada Lovelace"
          maxLength={255}
        />
        <TextField
          id="ap-email"
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          maxLength={255}
        />
      </div>

      <div className="mkt-grid-2-1">
        <TextField
          id="ap-phone"
          name="phone"
          label="Phone"
          optional
          type="tel"
          autoComplete="tel"
          placeholder="+1 555 123 4567"
          maxLength={50}
        />
        <TextField
          id="ap-location"
          name="location"
          label="Location"
          optional
          autoComplete="address-level2"
          placeholder="City, State / Country"
          maxLength={255}
        />
      </div>

      <div className="mkt-grid-2-1">
        <TextField
          id="ap-linkedin"
          name="linkedinUrl"
          label="LinkedIn"
          optional
          type="url"
          inputMode="url"
          placeholder="https://linkedin.com/in/…"
          maxLength={500}
        />
        <TextField
          id="ap-portfolio"
          name="portfolioUrl"
          label="Portfolio / site"
          optional
          type="url"
          inputMode="url"
          placeholder="https://…"
          maxLength={500}
        />
      </div>

      {role.interestPrompt ? (
        <div style={fieldStyle}>
          <Label htmlFor="ap-interest" style={labelStyle}>
            What would you own?
          </Label>
          <Textarea
            id="ap-interest"
            name="roleInterest"
            rows={4}
            placeholder={role.interestPrompt}
            maxLength={255}
          />
        </div>
      ) : null}

      <div style={fieldStyle}>
        <Label htmlFor="ap-cover" style={labelStyle}>
          Anything else? <span style={optionalStyle}>(optional)</span>
        </Label>
        <Textarea
          id="ap-cover"
          name="coverLetter"
          rows={5}
          placeholder="Tell us why this role, and point us to something you've shipped."
          maxLength={20000}
        />
      </div>

      <ResumeField required={role.resumeRequired} />

      {/* Honeypot — hidden from people, catnip for bots. */}
      <div aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}>
        <label htmlFor="ap-website">Website</label>
        <input id="ap-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
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

      <p style={{ ...hintStyle, margin: 0, lineHeight: '18px' }}>
        A real person — usually the founder — reads every application. No black hole, no bot screen.
      </p>
    </form>
  );
}

function ResumeField({ required }: { required: boolean }) {
  return (
    <div style={fieldStyle}>
      <Label htmlFor="ap-resume" style={labelStyle}>
        Résumé <span style={optionalStyle}>{required ? '(PDF)' : '(PDF, optional)'}</span>
      </Label>
      <input
        id="ap-resume"
        name="resume"
        type="file"
        accept="application/pdf"
        required={required}
        className="mkt-file-input"
      />
      <span style={hintStyle}>PDF, max 8 MB.</span>
    </div>
  );
}

function SubmitButton() {
  // useFormStatus reads the enclosing <form>'s pending state.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} style={{ width: '100%' }}>
      {pending ? 'Sending…' : 'Submit application →'}
    </Button>
  );
}

function Confirmation() {
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
        Application received
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
        Thank you — we&rsquo;ll be in touch. A real person reads every application, so give us a
        little time to do it justice.
      </p>
    </div>
  );
}
