import * as React from 'react';
import { cva, type VariantProps } from '../../utils/cva';
import { cn } from '../../utils/cn';
import { colorVars, type ColorKey } from '../_recipes/variants';

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
   *  one-off color that doesn't match the surrounding module. */
  accent?: ColorKey | (string & {});
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, accent, style, ...props }, ref) => {
    // The module variant tints its whole background by mixing the module color
    // into the card surface (so it reads as a clean tinted-white card in light
    // mode and a tinted-dark card in dark mode — never a fixed light hex). The
    // mix percentage is the "how present" knob; kept just under the soft
    // treatment's 14% so the surface reads as a deliberate module zone without
    // tipping into a heavy fill. With no `accent` we read `--color-module`
    // DIRECTLY so the tint follows the nearest <ModuleProvider> (a nested
    // provider on a cross-module panel just works). An explicit `accent` pins a
    // specific color via a local `--sx-sel` custom property set on THIS card, so
    // it can't be leaked in from an ancestor.
    const tintVar = accent ? 'var(--sx-sel)' : 'var(--color-module)';
    const moduleBg =
      variant === 'module'
        ? `bg-[color-mix(in_oklab,${tintVar}_12%,var(--color-base-100))]`
        : undefined;
    const accentStyle = accent
      ? ({ ['--sx-sel']: colorVars(accent).sel, ...style } as React.CSSProperties)
      : style;
    return (
      <div
        ref={ref}
        style={accentStyle}
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
  <h3 ref={ref} className={cn('text-base-content text-base font-medium', className)} {...props}>
    {children}
  </h3>
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-base-content/70 text-sm', className)} {...props} />
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
