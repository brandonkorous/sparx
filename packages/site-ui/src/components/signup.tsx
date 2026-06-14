// Signup — an inline email-capture form (the Builder "Email signup" block,
// docs/51 §7). PRESENTATIONAL: it owns the markup + theming and nothing else, so
// the live storefront and the editor canvas render it identically. The live site
// wraps it in a client island that supplies `onSubmit` + the `pending`/`done`/
// `message` state; the canvas renders it inert (no handlers) as a faithful
// preview. With no behavior props it's just a styled, non-submitting form.
//
// Composition: COMPOSITE (docs/23 §17) — assembles Heading + Text + Input + Button.

import * as React from 'react';
import { cx } from '../utils/cx';
import { Heading } from './heading';
import { Text } from './text';
import { Input } from './input';
import { Button } from './button';
import type { ColorKey, SizeKey } from './_recipes/variants';

export interface SignupProps {
  /** Submit button label. Defaults to `Subscribe`. */
  cta?: string;
  /** Email field placeholder. Defaults to `you@example.com`. */
  placeholder?: string;
  /** Optional copy above the field. */
  heading?: string;
  description?: string;
  /** Color slot for the field accent + button. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Control size. Defaults to `md`. */
  size?: SizeKey;
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
    <form className={cx('st-signup', className)} onSubmit={onSubmit} noValidate>
      {heading ? <Heading level="h3">{heading}</Heading> : null}
      {description ? <Text variant="body">{description}</Text> : null}
      {done ? (
        <p className="st-signup__status st-signup__status--ok" role="status">
          {message ?? 'Thanks — you’re subscribed.'}
        </p>
      ) : (
        <>
          <div className="st-signup__row">
            <label className="st-signup__label" htmlFor={fieldId}>
              Email address
            </label>
            <Input
              id={fieldId}
              type="email"
              name="email"
              autoComplete="email"
              placeholder={placeholder}
              required
              disabled={pending}
              color={color}
              size={size}
              invalid={error}
              className="st-signup__input"
            />
            <Button type="submit" color={color} size={size}>
              {pending ? 'Subscribing…' : cta}
            </Button>
          </div>
          {error && message ? (
            <p className="st-signup__status st-signup__status--error" role="alert">
              {message}
            </p>
          ) : null}
        </>
      )}
    </form>
  );
}
Signup.displayName = 'Signup';
