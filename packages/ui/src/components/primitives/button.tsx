'use client';

import * as React from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from '../../utils/cva';
import { cn } from '../../utils/cn';
import { Spinner } from './spinner';
import { colorClass, treatmentVariants, type ColorKey } from '../_recipes/variants';

// Button — the four-axis API (docs/35). `color` (semantic palette, runtime-
// extensible) is applied as a role-var class; `variant` (treatment), `size` and
// `shape` are CVA variants. color × variant composes through the --c-* role vars.

// Icon slot — `inline-flex items-center` centers the glyph in its own box. The
// span wrapper is needed for `shrink-0`, but a bare lucide `<svg>` inside renders
// `display:inline`, which drags a baseline/descender gap below it and floats the
// icon a couple px above the text's optical center (the classic icon-vs-label
// misalignment). Centering the icon inside the wrapper removes that gap so the
// glyph sits true to the label across every button on the platform.
const ICON_SLOT = 'inline-flex shrink-0 items-center';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center',
    'rounded-md font-medium',
    // Tailwind v4's Preflight no longer sets `cursor: pointer` on <button>, so a
    // bare <button> (unlike an asChild <a>, which the browser gives a pointer)
    // would render the default arrow — reading as "dead" and inconsistent with
    // link-buttons. Restore it here so every Button feels clickable; the
    // `disabled:pointer-events-none` below already suppresses it when disabled.
    'cursor-pointer',
    'transition-[color,background-color,border-color,filter] duration-150',
    'focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:outline-none',
    'disabled:pointer-events-none disabled:opacity-40',
    'whitespace-nowrap select-none',
  ],
  {
    variants: {
      variant: treatmentVariants,
      size: {
        xs: 'h-7 gap-1.5 px-2.5 text-xs',
        sm: 'h-8 gap-1.5 px-3 text-sm',
        md: 'h-9 gap-2 px-4 text-sm',
        lg: 'h-10 gap-2 px-5 text-base',
        xl: 'h-11 gap-2.5 px-6 text-base',
      },
      shape: {
        default: '',
        // Extra horizontal presence for a hero / primary action.
        wide: 'min-w-32',
        // Fills its container.
        block: 'w-full',
        // 1:1 icon button, field radius.
        square: 'aspect-square p-0',
        // 1:1 icon button, fully round.
        circle: 'aspect-square rounded-full p-0',
      },
    },
    defaultVariants: { variant: 'solid', size: 'md', shape: 'default' },
  }
);

export interface ButtonProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'>,
    VariantProps<typeof buttonVariants> {
  /** Semantic color slot. Known slots autocomplete; any string is accepted so
   *  a runtime custom theme color (`color="brand-mint"`) works once its
   *  `.sx-c-brand-mint` rule exists. Defaults to `primary`. */
  color?: ColorKey | (string & {});
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
      variant,
      size,
      shape,
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
    const classes = cn(colorClass(color), buttonVariants({ variant, size, shape }), className);

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

export { buttonVariants };
