// Button — the reference consumer of the site-ui variant recipe (docs/46 §6).
//
// FOUR-AXIS (docs/35): `color` (semantic palette, runtime-extensible) × `variant`
// (treatment) × `size`, themed entirely by --st-* through the role vars. `color`
// is applied as a `.st-c-*` role-var class; `variant` maps to a shared `.st-v-*`
// treatment authored once in recipes.css; `size` is the button's own padding
// scale. No flat enum — the same recipe drives every color-bearing component.
//
// No 'use client': the component emits markup + classes with no client runtime of
// its own, so the SSR site and the editor canvas render it identically. It accepts
// an optional `onClick` that it simply forwards to the underlying element — passing
// one (only legal from a client parent) doesn't change what the server/canvas emit,
// since neither supplies one. Static CTAs stay zero-JS via `href`; richer behaviour
// (a whole-card link with prefetch) rides on `asChild`.
//
// `asChild` merges the recipe classes onto a single child element instead of
// emitting a <button>/<a> — the Radix Slot pattern, implemented locally (a
// className-merging cloneElement, RSC-safe, no extra dependency). This is how a
// framework `<Link>` (Next.js) keeps client routing + prefetch while still
// reading as a typed `<Button>` at the call site.
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
   *  `.st-c-brand-mint` rule exists. Defaults to `primary`. */
  color?: ColorKey | (string & {});
  /** Treatment. Defaults to `solid`. */
  variant?: TreatmentKey;
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  /** Merge the recipe classes onto the single child element instead of rendering
   *  a `<button>`/`<a>`. Use to style a framework `<Link>`: keeps its routing /
   *  prefetch while wearing the Button recipe (`<Button asChild><Link …/></Button>`). */
  asChild?: boolean;
  /** When set (and not `asChild`), renders an `<a href>`; otherwise a native `<button>`. */
  href?: string;
  target?: React.HTMLAttributeAnchorTarget;
  rel?: string;
  /** Native button type (ignored when `href` or `asChild` is set). Defaults to `button`. */
  type?: 'button' | 'submit' | 'reset';
  /** Disable the control. On a `<button>` sets `disabled`; on an anchor sets
   *  `aria-disabled`. */
  disabled?: boolean;
  /** Click handler, forwarded to the rendered `<button>`/`<a>`. Only legal from a
   *  client parent; the SSR site and the canvas never pass one, so it doesn't
   *  affect their output. Ignored when `asChild` is set (the child owns handlers). */
  onClick?: React.MouseEventHandler<HTMLButtonElement & HTMLAnchorElement>;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  title?: string;
  'aria-label'?: string;
  children?: React.ReactNode;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'st-btn--sz-xs',
  sm: 'st-btn--sz-sm',
  md: 'st-btn--sz-md',
  lg: 'st-btn--sz-lg',
  xl: 'st-btn--sz-xl',
};

export function Button(props: ButtonProps): React.ReactElement {
  const {
    color = 'primary',
    variant = 'solid',
    size = 'md',
    asChild = false,
    href,
    target,
    rel,
    type = 'button',
    disabled = false,
    onClick,
    className,
    style,
    id,
    title,
    children,
  } = props;
  const ariaLabel = props['aria-label'];
  const classes = cx(
    'st-btn',
    colorClass(color),
    treatmentVariants[variant],
    SIZE_CLASS[size],
    className
  );

  // asChild: clone the single child, merging the recipe classes (and style) onto
  // it. Lets `<Button asChild><Link href>…</Link></Button>` keep the Link's
  // routing while wearing the Button recipe. The child owns its own href/onClick.
  if (asChild) {
    const child = React.Children.only(children) as React.ReactElement<{
      className?: string;
      style?: React.CSSProperties;
    }>;
    return React.cloneElement(child, {
      className: cx(classes, child.props.className),
      style: style ? { ...style, ...child.props.style } : child.props.style,
    });
  }

  if (href !== undefined) {
    return (
      <a
        href={disabled ? undefined : href}
        target={target}
        rel={rel}
        className={classes}
        style={style}
        id={id}
        title={title}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      className={classes}
      style={style}
      id={id}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
Button.displayName = 'Button';
