// Button — the reference consumer of the site-ui variant recipe (docs/46 §6).
//
// FOUR-AXIS (docs/35): `color` (semantic palette, runtime-extensible) × `variant`
// (treatment) × `size`, themed entirely by --sf-* through the role vars. `color`
// is applied as a `.sf-c-*` role-var class; `variant` maps to a shared `.sf-v-*`
// treatment authored once in recipes.css; `size` is the button's own padding
// scale. No flat enum — the same recipe drives every color-bearing component.
//
// SERVER component (no 'use client'): emits markup + classes, no client runtime,
// so the server storefront and the client editor canvas render it identically.
// Presentational by design — interactivity via `href` (anchor) or a thin client
// wrapper later, never an `onClick` on the base component.
//
// The old dark/glass scrim CTAs are now compositions: Order Now = `glass` ×
// `neutral`, Learn More = `glass` × `surface`.

import * as React from 'react';
import { cx } from '../utils/cx';
import {
  colorClass,
  treatmentVariants,
  type ColorKey,
  type SizeKey,
  type TreatmentKey,
} from './_recipes/variants';

export interface ButtonProps {
  /** Semantic color slot. Known slots autocomplete; any string is accepted so a
   *  runtime custom theme color (`color="brand-mint"`) works once its
   *  `.sf-c-brand-mint` rule exists. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Treatment. Defaults to `solid`. */
  variant?: TreatmentKey;
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  /** When set, renders an `<a href>`; otherwise a native `<button>`. */
  href?: string;
  target?: React.HTMLAttributeAnchorTarget;
  rel?: string;
  /** Native button type (ignored when `href` is set). Defaults to `button`. */
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  title?: string;
  'aria-label'?: string;
  children?: React.ReactNode;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  sm: 'sf-btn--sz-sm',
  md: 'sf-btn--sz-md',
  lg: 'sf-btn--sz-lg',
};

export function Button(props: ButtonProps): React.ReactElement {
  const {
    color = 'primary',
    variant = 'solid',
    size = 'md',
    href,
    target,
    rel,
    type = 'button',
    className,
    style,
    id,
    title,
    children,
  } = props;
  const ariaLabel = props['aria-label'];
  const classes = cx(
    'sf-btn',
    colorClass(color),
    treatmentVariants[variant],
    SIZE_CLASS[size],
    className
  );

  if (href !== undefined) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        className={classes}
        style={style}
        id={id}
        title={title}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      style={style}
      id={id}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
Button.displayName = 'Button';
