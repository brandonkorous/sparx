'use client';

import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { colorVars, type ColorKey } from '../_recipes/variants';

const SIZES = {
  sm: { box: 'h-3.5 w-3.5', dot: 'h-1.5 w-1.5' },
  md: { box: 'h-4 w-4', dot: 'h-2 w-2' },
  lg: { box: 'h-5 w-5', dot: 'h-2.5 w-2.5' },
} as const;

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn('grid gap-2', className)} {...props} />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

export interface RadioGroupItemProps extends Omit<
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>,
  'color'
> {
  /** Selected-state color (default `primary`). Accepts any palette/custom slot. */
  color?: ColorKey | (string & {});
  size?: keyof typeof SIZES;
}

// Radix control — the selected ring + dot are driven off a per-instance
// `--sx-sel` custom property set to the silicaui color token (default primary).
export const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, color = 'primary', size = 'md', style, ...props }, ref) => {
  const s = SIZES[size];
  const { sel } = colorVars(color);
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      style={{ ['--sx-sel']: sel, ...style } as React.CSSProperties}
      className={cn(
        'aspect-square rounded-full border',
        s.box,
        'border-[var(--color-base-300)] bg-[var(--color-base-100)]',
        'transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-[var(--sx-sel)] data-[state=checked]:text-[var(--sx-sel)]',
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className={cn(s.dot, 'fill-current')} />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;
