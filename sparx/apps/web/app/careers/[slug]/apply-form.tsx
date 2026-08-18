'use client';

// The /careers/[slug] application form. Posts to the submitApplication server
// action (React 19 form action), which forwards to the platform's public careers
// API and uploads the résumé PDF. On success the whole form swaps for an inline
// confirmation. Mirrors the /early waitlist form's structure (useActionState +
// client-gated validation + honeypot + silica Field composition).

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
import { rule, rules, useFieldValidation } from '@wizeworks/forms';
import { Spark } from '@/components/marketing/primitives';
import { submitApplication, type ApplicationState } from '../actions';

const INITIAL: ApplicationState = { status: 'idle' };

const LABEL_CLASS = 'text-sm font-medium';
const OPTIONAL_CLASS = 'font-normal';

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
      <FieldLabel required={!optional} className={LABEL_CLASS}>
        {label}
        {optional ? <span className={OPTIONAL_CLASS}> (optional)</span> : null}
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
    <form action={clientAction} className="flex flex-col gap-[18px]" noValidate>
      {/* Carries the role identity to the server action. */}
      <input type="hidden" name="roleSlug" value={role.slug} />
      <input type="hidden" name="roleTitle" value={role.title} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
          <FieldLabel className={LABEL_CLASS}>What would you own?</FieldLabel>
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
        <FieldLabel className={LABEL_CLASS}>
          Anything else? <span className={OPTIONAL_CLASS}>(optional)</span>
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
      <div aria-hidden className="absolute left-[-9999px] h-px w-px">
        <label htmlFor="ap-website">Website</label>
        <input id="ap-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === 'error' ? (
        <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
          {state.message}
        </FieldStatus>
      ) : null}

      <SubmitButton pending={pending} />

      <p className="m-0 text-sm">
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
      <FieldLabel required={required} className={LABEL_CLASS}>
        Résumé <span className={OPTIONAL_CLASS}>{required ? '(PDF)' : '(PDF, optional)'}</span>
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
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Sending…' : 'Submit application →'}
    </Button>
  );
}

function Confirmation() {
  return (
    <div role="status" className="flex flex-col items-start gap-3.5 py-2">
      <span
        aria-hidden
        className="bg-primary bg-soft text-primary inline-flex h-11 w-11 items-center justify-center rounded-full text-2xl"
      >
        ✓
      </span>
      <span className="text-2xl font-medium tracking-[-0.02em]">
        Application received
        <Spark />
      </span>
      <p className="text-md m-0 max-w-[380px]">
        Thank you — we&rsquo;ll be in touch. A real person reads every application, so give us a
        little time to do it justice.
      </p>
    </div>
  );
}
