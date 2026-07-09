'use client';

// The /careers/[slug] application form. Posts to the submitApplication server
// action (React 19 form action), which forwards to the platform's public careers
// API and uploads the résumé PDF. On success the whole form swaps for an inline
// confirmation. Mirrors the /early waitlist form's structure (useActionState +
// client-gated validation + honeypot + inline-CSS-var field styling).

import { useActionState, useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, rules, useFieldValidation } from '@sparx/forms';
import { Spark } from '@/components/marketing/primitives';
import { submitApplication, type ApplicationState } from '../actions';

const INITIAL: ApplicationState = { status: 'idle' };

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--color-base-content)',
};

const optionalStyle: React.CSSProperties = {
  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
  fontWeight: 400,
};

const hintStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '12px',
  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
};

export interface ApplyFormRole {
  slug: string;
  title: string;
  resumeRequired: boolean;
  interestPrompt?: string;
}

type TextFieldProps = {
  label: string;
  optional?: boolean;
  fieldStatus?: { status?: 'error' | 'warning' | 'success'; statusMessage?: string };
} & React.ComponentProps<'input'>;

function TextField({ label, optional, fieldStatus, ...control }: TextFieldProps) {
  return (
    <Field {...fieldStatus}>
      <FieldLabel required={!optional} style={labelStyle}>
        {label}
        {optional ? <span style={optionalStyle}> (optional)</span> : null}
      </FieldLabel>
      <FieldControl {...control} />
    </Field>
  );
}

export function ApplyForm({ role }: { role: ApplyFormRole }) {
  const [state, action, pending] = useActionState(submitApplication, INITIAL);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  const v = useFieldValidation(
    { fullName, email },
    {
      fullName: rule.required('Enter your full name.'),
      email: rules(rule.required('Enter your email.'), rule.email()),
    }
  );

  if (state.status === 'success') {
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
      style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
      noValidate
    >
      {/* Carries the role identity to the server action. */}
      <input type="hidden" name="roleSlug" value={role.slug} />
      <input type="hidden" name="roleTitle" value={role.title} />

      <div className="mkt-grid-2-1">
        <TextField
          name="fullName"
          label="Full name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          maxLength={255}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          fieldStatus={v.field('fullName')}
          {...v.control('fullName')}
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          maxLength={255}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fieldStatus={v.field('email')}
          {...v.control('email')}
        />
      </div>

      <div className="mkt-grid-2-1">
        <TextField
          name="phone"
          label="Phone"
          optional
          type="tel"
          autoComplete="tel"
          placeholder="+1 555 123 4567"
          maxLength={50}
        />
        <TextField
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
          name="linkedinUrl"
          label="LinkedIn"
          optional
          type="url"
          inputMode="url"
          placeholder="https://linkedin.com/in/…"
          maxLength={500}
        />
        <TextField
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
        <Field>
          <FieldLabel style={labelStyle}>What would you own?</FieldLabel>
          <FieldControl
            render={
              <Textarea
                name="roleInterest"
                rows={4}
                placeholder={role.interestPrompt}
                maxLength={255}
              />
            }
          />
        </Field>
      ) : null}

      <Field>
        <FieldLabel style={labelStyle}>
          Anything else? <span style={optionalStyle}>(optional)</span>
        </FieldLabel>
        <FieldControl
          render={
            <Textarea
              name="coverLetter"
              rows={5}
              placeholder="Tell us why this role, and point us to something you've shipped."
              maxLength={20000}
            />
          }
        />
      </Field>

      <ResumeField required={role.resumeRequired} />

      {/* Honeypot — hidden from people, catnip for bots. */}
      <div aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}>
        <label htmlFor="ap-website">Website</label>
        <input id="ap-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === 'error' ? (
        <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
          {state.message}
        </FieldStatus>
      ) : null}

      <SubmitButton pending={pending} />

      <p style={{ ...hintStyle, margin: 0, lineHeight: '18px' }}>
        A real person — usually the founder — reads every application. No black hole, no bot screen.
      </p>
    </form>
  );
}

function ResumeField({ required }: { required: boolean }) {
  // The résumé file input is left native (file inputs can't be controlled); only
  // its label + hint adopt the Field composition for consistency.
  return (
    <Field>
      <FieldLabel required={required} style={labelStyle}>
        Résumé <span style={optionalStyle}>{required ? '(PDF)' : '(PDF, optional)'}</span>
      </FieldLabel>
      <FieldControl
        render={
          <input
            name="resume"
            type="file"
            accept="application/pdf"
            required={required}
            className="mkt-file-input"
          />
        }
      />
      <FieldDescription>PDF, max 8 MB.</FieldDescription>
    </Field>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
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
        Application received
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
        Thank you — we&rsquo;ll be in touch. A real person reads every application, so give us a
        little time to do it justice.
      </p>
    </div>
  );
}
