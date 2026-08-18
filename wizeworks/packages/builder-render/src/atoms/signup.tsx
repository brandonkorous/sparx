// Signup — an inline email-capture form (the Builder "Email signup" block).
//
// A composition of silica's `input` + `btn` in the shape one builder node needs
// (root CLAUDE.md RULE #1). PRESENTATIONAL: it owns the markup and nothing else,
// so the live storefront and the editor canvas render it identically. The live
// site wraps it in a client island that supplies `onSubmit` plus the `pending` /
// `done` / `message` state; the canvas renders it inert as a faithful preview.
// With no behavior props it is a styled, non-submitting form.
//
// SERVER-safe: silica's `input`/`btn` classes are applied directly rather than
// through the `'use client'` React components, so a canvas preview ships no JS.

import * as React from 'react';
import { buttonClasses, cx } from '@wizeworks/silicaui-react/server';
import type { ButtonColor, ButtonSize } from '@wizeworks/silicaui-react/server';

export interface SignupProps {
  /** Submit button label. Defaults to `Subscribe`. */
  cta?: string;
  /** Email field placeholder. Defaults to `you@example.com`. */
  placeholder?: string;
  /** Optional copy above the field. */
  heading?: string;
  description?: string;
  /** Color slot for the field accent + button. Defaults to `primary`. */
  color?: ButtonColor;
  /** Control size. Defaults to `md`. */
  size?: ButtonSize;
  /** Submit handler — when omitted the form is inert (canvas preview). */
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  /** In-flight: disables the controls and shows a working label. */
  pending?: boolean;
  /** Success: replaces the form with the confirmation message. */
  done?: boolean;
  /** Status text — the success confirmation (when `done`) or an error. */
  message?: string;
  /** Truthy → render `message` as an error beneath the field. */
  error?: boolean;
  className?: string;
}

export function Signup({
  cta = 'Subscribe',
  placeholder = 'you@example.com',
  heading,
  description,
  color = 'primary',
  size = 'md',
  onSubmit,
  pending = false,
  done = false,
  message,
  error = false,
  className,
}: SignupProps): React.ReactElement {
  const fieldId = React.useId();
  return (
    <form className={cx('flex flex-col gap-3', className)} onSubmit={onSubmit} noValidate>
      {heading ? <h3 className="h3">{heading}</h3> : null}
      {description ? <p className="leading-relaxed">{description}</p> : null}
      {done ? (
        <p className="text-success" role="status">
          {message ?? 'Thanks — you’re subscribed.'}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {/* The label is for assistive tech only: the field's purpose is
                already carried by the placeholder and the button beside it, and
                a visible "Email address" above a one-line signup row reads as
                clutter. `sr-only` hides it visually without removing it. */}
            <label className="sr-only" htmlFor={fieldId}>
              Email address
            </label>
            <input
              id={fieldId}
              type="email"
              name="email"
              autoComplete="email"
              placeholder={placeholder}
              required
              disabled={pending}
              aria-invalid={error || undefined}
              className={cx('input', `input-${error ? 'error' : color}`, `input-${size}`, 'flex-1')}
            />
            <button type="submit" disabled={pending} className={buttonClasses({ color, size })}>
              {pending ? 'Subscribing…' : cta}
            </button>
          </div>
          {error && message ? (
            <p className="text-error" role="alert">
              {message}
            </p>
          ) : null}
        </>
      )}
    </form>
  );
}
Signup.displayName = 'Signup';
