import * as React from 'react';
import { cva, type VariantProps } from '../../utils/cva';
import { cn } from '../../utils/cn';
import { colorClass, type ColorKey } from '../_recipes/variants';

const cardVariants = cva(
  'rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]',
  {
    variants: {
      variant: {
        default: '',
        // Background tint only — the tint COLOR is applied in the component so it
        // can read `--module-active-tint` directly (see below). No top stripe.
        module: '',
        elevated: 'shadow-md',
        ghost: 'border-transparent bg-transparent',
        subtle: 'border-transparent bg-[var(--color-bg-subtle)]',
      },
      padding: {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
      },
    },
    defaultVariants: { variant: 'default', padding: 'md' },
  }
);

export interface CardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>, VariantProps<typeof cardVariants> {
  /** Pins the `module` variant's background tint to a specific palette/module
   *  color (e.g. `accent="inventory"`). Omit it and the tint follows the nearest
   *  `<ModuleProvider>` — the normal way to color a card is to wrap the panel in
   *  its module's provider, NOT to pass accent. Reach for accent only for a
   *  one-off color that doesn't match the surrounding module. */
  accent?: ColorKey | (string & {});
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, accent, ...props }, ref) => {
    // The module variant tints its whole background by mixing the module color
    // into the card surface (so it reads as a clean tinted-white card in light
    // mode and a tinted-dark card in dark mode — never a fixed light hex). The
    // mix percentage is the "how present" knob; kept just under the soft
    // treatment's 14% so the surface reads as a deliberate module zone without
    // tipping into a heavy fill. With no `accent` we read `--module-active` DIRECTLY so the
    // tint follows the nearest <ModuleProvider> (a nested provider on a
    // cross-module panel just works). We deliberately do NOT fall back through
    // the shared, inheritable `--c-bg` role var: an ancestor's color recipe can
    // leak it into this subtree and silently override the active module (the bug
    // this guards against). An explicit `accent` sets `--c-bg` on THIS card via
    // its role class, so reading `--c-bg` then is safe and local.
    const moduleBg =
      variant === 'module'
        ? accent
          ? 'bg-[color-mix(in_oklab,var(--c-bg)_12%,var(--color-bg-surface))]'
          : 'bg-[color-mix(in_oklab,var(--module-active)_12%,var(--color-bg-surface))]'
        : undefined;
    return (
      <div
        ref={ref}
        className={cn(
          accent && colorClass(accent),
          cardVariants({ variant, padding }),
          moduleBg,
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mb-3 flex flex-col gap-1', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-base font-medium text-[var(--color-text-primary)]', className)}
    {...props}
  >
    {children}
  </h3>
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-[var(--color-text-secondary)]', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('', className)} {...props} />
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'mt-4 flex items-center justify-end gap-2 border-t border-[var(--color-border-default)] pt-4',
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

export { cardVariants };
