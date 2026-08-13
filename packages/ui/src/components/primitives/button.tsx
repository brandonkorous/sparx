'use client';

import * as React from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cn } from '../../utils/cn';
import { Spinner } from './spinner';
import { type ColorKey } from '../_recipes/variants';

// Button — the four-axis API (docs/35). `color` (semantic palette) × `variant`
// (treatment) × `size` × `shape` compose onto silicaui's `.btn` component
// classes: silica owns the full look (padding, height, radius, focus ring,
// disabled, cursor, gap, transition), so this component only picks the class
// tokens and keeps the sparx ergonomics — asChild, loading spinner, icon slots.

// Icon slot — `inline-flex items-center` centers the glyph in its own box. The
// span wrapper is needed for `shrink-0`, but a bare lucide `<svg>` inside renders
// `display:inline`, which drags a baseline/descender gap below it and floats the
// icon a couple px above the text's optical center (the classic icon-vs-label
// misalignment). Centering the icon inside the wrapper removes that gap so the
// glyph sits true to the label across every button on the platform.
const ICON_SLOT = 'inline-flex shrink-0 items-center';

// ── silica class maps ───────────────────────────────────────────────────────
// `color` → `btn-<color>`. The known semantic slots map 1:1 to silica's
// registered colors (danger + module are registered in each app's silicaui
// plugin config); an unmapped runtime color falls back to `btn-<color>`, which
// styles once a matching plugin color exists.
const BTN_COLOR: Record<ColorKey, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  accent: 'btn-accent',
  neutral: 'btn-neutral',
  info: 'btn-info',
  success: 'btn-success',
  warning: 'btn-warning',
  danger: 'btn-danger',
  module: 'btn-module',
  // per-module direct slots resolve through the active <ModuleProvider>; a bare
  // color="cms" emits btn-cms (styled only where that plugin color is registered).
  builder: 'btn-builder',
  commerce: 'btn-commerce',
  cms: 'btn-cms',
  crm: 'btn-crm',
  email: 'btn-email',
  b2b: 'btn-b2b',
  invoicing: 'btn-invoicing',
  ai: 'btn-ai',
  dropship: 'btn-dropship',
  inventory: 'btn-inventory',
  chat: 'btn-chat',
  scheduling: 'btn-scheduling',
  automations: 'btn-automations',
  seo: 'btn-seo',
  social: 'btn-social',
  finance: 'btn-finance',
  staff: 'btn-staff',
};

// `variant` (treatment) → silica modifier. `solid` is silica's default `.btn`
// (no modifier); `dashed` is silica's `btn-dash`.
const BTN_VARIANT = {
  solid: '',
  soft: 'btn-soft',
  outline: 'btn-outline',
  dashed: 'btn-dash',
  ghost: 'btn-ghost',
  link: 'btn-link',
} as const;

const BTN_SIZE = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
  xl: 'btn-xl',
} as const;

const BTN_SHAPE = {
  default: '',
  wide: 'btn-wide',
  block: 'btn-block',
  square: 'btn-square',
  circle: 'btn-circle',
} as const;

export type ButtonVariant = keyof typeof BTN_VARIANT;
export type ButtonSize = keyof typeof BTN_SIZE;
export type ButtonShape = keyof typeof BTN_SHAPE;

/** Resolve the four axes to a silicaui `.btn` class string. Shared with the
 *  handful of composites that style a bare element as a button (alert-dialog,
 *  confirm-provider) instead of rendering <Button>. */
export function buttonClasses(opts?: {
  color?: ColorKey | (string & {});
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
}): string {
  const { color = 'primary', variant = 'solid', size = 'md', shape = 'default' } = opts ?? {};
  return cn(
    'btn',
    BTN_COLOR[color as ColorKey] ?? `btn-${color}`,
    BTN_VARIANT[variant],
    BTN_SIZE[size],
    BTN_SHAPE[shape]
  );
}

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  /** Semantic color slot. Known slots autocomplete; any string is accepted so a
   *  runtime custom theme color works once its silicaui plugin color exists.
   *  Defaults to `primary`. */
  color?: ColorKey | (string & {});
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      color = 'primary',
      variant = 'solid',
      size = 'md',
      shape = 'default',
      loading = false,
      leftIcon,
      rightIcon,
      asChild = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const classes = cn(buttonClasses({ color, variant, size, shape }), className);

    // With asChild, Slot merges the button's styling onto the provided child
    // (e.g. a `<Link>`).
    if (asChild) {
      // Icon/spinner slots need `Slottable` so they sit as siblings of the child's
      // own content. But that composition (Slottable + falsy icon siblings) trips a
      // hydration mismatch against a Next `<Link>` child, so only take it when a
      // slot is actually present. The common case — an asChild link with no
      // leftIcon/rightIcon/loading — uses the plain single-child Slot, which
      // hydrates cleanly (icons there are composed inside the child).
      if (loading || leftIcon || rightIcon) {
        return (
          <Slot ref={ref} className={classes} {...props}>
            {loading ? (
              <Spinner size="sm" />
            ) : (
              leftIcon && <span className={ICON_SLOT}>{leftIcon}</span>
            )}
            <Slottable>{children}</Slottable>
            {rightIcon && !loading && <span className={ICON_SLOT}>{rightIcon}</span>}
          </Slot>
        );
      }
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled ?? loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Spinner size="sm" />
        ) : (
          leftIcon && <span className={ICON_SLOT}>{leftIcon}</span>
        )}
        {children}
        {rightIcon && !loading && <span className={ICON_SLOT}>{rightIcon}</span>}
      </button>
    );
  }
);
Button.displayName = 'Button';
