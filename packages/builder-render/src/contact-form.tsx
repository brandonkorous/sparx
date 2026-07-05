'use client';

// ContactForm island — the interactive half of the Builder "Contact form" block
// (docs/115). The richer sibling of SignupForm: it renders the same fields on the
// live storefront and the editor canvas, validates on submit, then calls the
// injected runtime's `submitForm` effect and swaps to a thank-you.
//
// The effect is injected (runtime-context.tsx): live POSTs to the public forms
// endpoint with the trusted tenant/site + page locator (added by the apps/site
// bridge, never by this component); the editor canvas no-ops it — so the SAME
// form renders + validates in the canvas without capturing anything. Routing
// (who gets emailed, whether it lands in the CRM) is resolved server-side from
// the form's saved config; this island only sends field values.

import { useState } from 'react';

import {
  readContactFormConfig,
  contactFormFields,
  type ContactFormField,
} from '@sparx/builder-schemas';
import { Button, Field, Input, Textarea, Heading, Text } from '@sparx/site-ui';

import { useBuilderRuntime } from './runtime-context';

type Status = 'idle' | 'pending' | 'done' | 'error';

export function ContactForm({
  nodeId,
  props,
  className,
}: {
  nodeId: string;
  props: Record<string, unknown>;
  className?: string;
}) {
  const { submitForm } = useBuilderRuntime();
  const cfg = readContactFormConfig(props);
  const fields = contactFormFields(cfg);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'pending') return;
    const form = new FormData(e.currentTarget);
    const values: Record<string, string> = {};
    for (const f of fields) {
      const raw = form.get(f.key);
      values[f.key] = (typeof raw === 'string' ? raw : '').trim();
    }
    // Client-side validation — the server re-validates; this is just fast feedback.
    const missing = fields.find((f) => f.required && !values[f.key]);
    if (missing) {
      setStatus('error');
      setError(`Please fill in the ${missing.label.toLowerCase()} field.`);
      return;
    }
    if (values.email && !values.email.includes('@')) {
      setStatus('error');
      setError('Please enter a valid email address.');
      return;
    }
    const honeypotRaw = form.get('company_url');
    const honeypot = typeof honeypotRaw === 'string' ? honeypotRaw : '';

    setStatus('pending');
    setError(null);
    try {
      await submitForm({ nodeId, values, honeypot });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (status === 'done') {
    return (
      <div className={className}>
        <p className="st-callout st-c-success st-v-soft" role="status">
          {cfg.successMessage}
        </p>
      </div>
    );
  }

  const nameField = fields.find((f) => f.key === 'name');
  const emailField = fields.find((f) => f.key === 'email');
  const restFields = fields.filter((f) => f.key !== 'name' && f.key !== 'email');

  return (
    <form className={className} onSubmit={onSubmit} noValidate>
      {cfg.title || cfg.description ? (
        <div className="flex flex-col gap-1">
          {cfg.title ? (
            <Heading level="h3" className="text-base-content text-lg font-semibold">
              {cfg.title}
            </Heading>
          ) : null}
          {cfg.description ? (
            <Text variant="body" className="text-base-content/60 text-sm">
              {cfg.description}
            </Text>
          ) : null}
        </div>
      ) : null}

      {/* Honeypot — off-screen, non-tabbable, ignored by humans; a filled value
          means a bot and the server silently drops the submission. */}
      <div
        aria-hidden
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
      >
        <label>
          Company website
          <input type="text" name="company_url" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {nameField && emailField ? (
        <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
          <ContactField field={nameField} color={cfg.color} disabled={status === 'pending'} />
          <ContactField field={emailField} color={cfg.color} disabled={status === 'pending'} />
        </div>
      ) : null}

      {restFields.map((f) => (
        <ContactField key={f.key} field={f} color={cfg.color} disabled={status === 'pending'} />
      ))}

      {status === 'error' && error ? (
        <p className="st-field__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end">
        <Button type="submit" color={cfg.color} disabled={status === 'pending'}>
          {status === 'pending' ? 'Sending…' : cfg.submitLabel}
        </Button>
      </div>
    </form>
  );
}
ContactForm.displayName = 'ContactForm';

function ContactField({
  field,
  color,
  disabled,
}: {
  field: ContactFormField;
  color: string;
  disabled: boolean;
}) {
  const control =
    field.type === 'textarea' ? (
      <Textarea
        name={field.key}
        rows={4}
        placeholder={field.placeholder}
        required={field.required}
        disabled={disabled}
        color={color}
      />
    ) : (
      <Input
        type={field.type}
        name={field.key}
        placeholder={field.placeholder}
        autoComplete={field.autoComplete}
        required={field.required}
        disabled={disabled}
        color={color}
      />
    );
  return (
    <Field label={field.label} required={field.required} className="w-full">
      {control}
    </Field>
  );
}
