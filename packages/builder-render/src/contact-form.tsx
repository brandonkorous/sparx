'use client';

// Form island — the interactive half of the Builder "Form" block (docs/115). It
// wraps its Builder CHILDREN in a real `<form>`: the fields are ordinary named input
// atoms (Input / Textarea / Select / Checkbox / …) the author composed with the
// normal builder, not a hardcoded field list. On submit it collects every named
// control in the subtree (`new FormData`), then calls the injected runtime's
// `submitForm` effect and swaps to a thank-you.
//
// The effect is injected (runtime-context.tsx): live POSTs to the public forms
// endpoint with the trusted tenant/site + page locator (added by the apps/site
// bridge, never by this component); the editor canvas no-ops it — so the SAME form
// renders in the canvas without capturing anything. Routing (who gets emailed,
// whether it lands in the CRM) is resolved server-side from the form's saved config;
// this island only sends field values. It renders its OWN submit button (a composed
// Builder <Button> emits type="button" and wouldn't submit) so submission always
// works while the fields stay fully composable.

import { useState } from 'react';

import {
  readContactFormConfig,
  isAllowedAttachmentMime,
  FORM_ATTACHMENT_MIME,
  MAX_FORM_ATTACHMENT_BYTES,
  MAX_FORM_ATTACHMENTS,
} from '@sparx/builder-schemas';
import { buttonClasses } from '@wizeworks/silicaui-react/server';

import { useBuilderRuntime } from './runtime-context';

type Status = 'idle' | 'pending' | 'done' | 'error';

/** The hidden honeypot field name — a bot fills it, a human never sees it. */
const HONEYPOT = 'company_url';

/** Friendly one-line summary of the accepted file types (unique extensions). */
const ACCEPTED_TYPES = [...new Set(Object.values(FORM_ATTACHMENT_MIME))].join(', ');

/** Client-side pre-check for attached files: count, per-file size, and type. A fast,
 *  honest guard before the round-trip — the SERVER still magic-sniffs every byte, so
 *  this never becomes the security boundary. Returns an error string, or null. */
function validateFiles(files: File[]): string | null {
  // Widen to `number` via an identifier-initialized local: the exported constant is a
  // literal (`3`), so comparing it directly to `1` trips the unintentional-comparison
  // check — and an identifier initializer keeps no-inferrable-types from stripping the
  // annotation (which is what re-broke this).
  const max: number = MAX_FORM_ATTACHMENTS;
  if (files.length > max) {
    return `Please attach at most ${max} file${max === 1 ? '' : 's'}.`;
  }
  const maxMb = Math.round(MAX_FORM_ATTACHMENT_BYTES / (1024 * 1024));
  for (const file of files) {
    if (file.size > MAX_FORM_ATTACHMENT_BYTES) {
      return `"${file.name}" is too large — files must be under ${maxMb} MB.`;
    }
    if (!isAllowedAttachmentMime(file.type)) {
      return `"${file.name}" isn't an accepted file type. Accepted: ${ACCEPTED_TYPES}.`;
    }
  }
  return null;
}

export function ContactForm({
  nodeId,
  props,
  className,
  children,
}: {
  nodeId: string;
  props: Record<string, unknown>;
  className?: string;
  children?: React.ReactNode;
}) {
  const { submitForm } = useBuilderRuntime();
  const cfg = readContactFormConfig(props);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'pending') return;
    const fd = new FormData(e.currentTarget);
    const honeypotRaw = fd.get(HONEYPOT);
    const honeypot = typeof honeypotRaw === 'string' ? honeypotRaw : '';

    // Collect every named control the author dropped in. A repeated name (a checkbox
    // group) accumulates into a comma-joined value so nothing is silently lost. File
    // inputs surface as File objects, not strings — they're collected separately.
    const values: Record<string, string> = {};
    const files: File[] = [];
    for (const [key, raw] of fd.entries()) {
      if (key === HONEYPOT) continue;
      if (raw instanceof File) {
        // A file input with no selection yields an empty File — skip it.
        if (raw.size > 0) files.push(raw);
        continue;
      }
      if (typeof raw !== 'string') continue;
      const v = raw.trim();
      values[key] = key in values && values[key] ? `${values[key]}, ${v}` : v;
    }

    // Light client-side validation for fast feedback — the browser's own `required`
    // handles empties; we just guard an obviously malformed email before the round-trip.
    if (values.email && !values.email.includes('@')) {
      setStatus('error');
      setError('Please enter a valid email address.');
      return;
    }
    const fileError = validateFiles(files);
    if (fileError) {
      setStatus('error');
      setError(fileError);
      return;
    }

    setStatus('pending');
    setError(null);
    try {
      await submitForm({ nodeId, values, honeypot, files });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (status === 'done') {
    return (
      <div className={className}>
        <p className="alert alert-success alert-soft" role="status">
          {cfg.successMessage}
        </p>
      </div>
    );
  }

  return (
    <form className={className} onSubmit={onSubmit} noValidate>
      {/* Honeypot — off-screen, non-tabbable, ignored by humans; a filled value means
          a bot and the server silently drops the submission. */}
      <div
        aria-hidden
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
      >
        <label>
          Company website
          <input type="text" name={HONEYPOT} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* The author-composed fields (and any heading / helper copy). */}
      {children}

      {status === 'error' && error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end">
        <button
          type="submit"
          className={buttonClasses({ color: cfg.color })}
          disabled={status === 'pending'}
        >
          {status === 'pending' ? 'Sending…' : cfg.submitLabel}
        </button>
      </div>
    </form>
  );
}
ContactForm.displayName = 'ContactForm';
