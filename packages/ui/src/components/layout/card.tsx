import * as React from 'react';
import { cva, type VariantProps } from '../../utils/cva';
import { cn } from '../../utils/cn';
import { pluginColor, type ColorKey } from '../_recipes/variants';

const cardVariants = cva('border-base-300 bg-base-100 rounded-lg border', {
  variants: {
    variant: {
      default: '',
      // Background tint only — the tint COLOR is applied in the component so it
      // can read the active module color directly (see below). No top stripe.
      module: '',
      elevated: 'shadow-md',
      ghost: 'border-transparent bg-transparent',
      subtle: 'bg-base-200 border-transparent',
    },
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    },
  },
  defaultVariants: { variant: 'default', padding: 'md' },
});

export interface CardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>, VariantProps<typeof cardVariants> {
  /** Pins the `module` variant's background tint to a specific palette/module
   *  color (e.g. `accent="inventory"`). Omit it and the tint follows the nearest
   *  `<ModuleProvider>` — the normal way to color a card is to wrap the panel in
   *  its module's provider, NOT to pass accent. Reach for accent only for a
   *  one-off color that doesn't match the surrounding module.
   *
   *  A MODULE name here resolves only in an app that registered the full module
   *  palette (workbench + web); admin and site register `module` alone, so the
   *  provider route is the portable one. A semantic name (`success`, `warning`)
   *  works everywhere. */
  accent?: ColorKey | (string & {});
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, accent, ...props }, ref) => {
    // The module variant tints its whole background with silicaui's UNIVERSAL
    // `soft` treatment — `bg-<color> bg-soft` resolves to a theme-aware
    // color-mix of that color into the surface, so it reads as a tinted-white
    // card in light mode and a tinted-dark one in dark mode, never a fixed hex.
    //
    // With no `accent` the color is `module`, which reads --color-module and so
    // follows the nearest <ModuleProvider> (a nested provider on a cross-module
    // panel just works). An explicit `accent` names a different plugin color on
    // THIS card, so an ancestor's hue can't leak in.
    //
    // This was a hand-rolled 12% color-mix off an `--sx-sel` custom property.
    // Both are gone: the mix percentage now lives in silica's `soft`, one place,
    // so retuning the tint is a silica change rather than a sweep through here.
    // `cn` registers `bg-soft` as its own tailwind-merge group precisely so it
    // can sit beside `bg-<color>` without stripping it (see packages/ui/CLAUDE.md).
    const moduleBg =
      variant === 'module' ? `bg-${pluginColor(accent ?? 'module')} bg-soft` : undefined;
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, padding }), moduleBg, className)}
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
  <h3 ref={ref} className={cn('text-base font-medium', className)} {...props}>
    {children}
  </h3>
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm', className)} {...props} />
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
        'border-base-300 mt-4 flex items-center justify-end gap-2 border-t pt-4',
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

export { cardVariants };
