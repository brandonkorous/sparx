'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '../../utils/cn';
import { colorVars, type ColorKey } from '../_recipes/variants';

const SIZES = {
    sm: { box: 'h-3.5 w-3.5', icon: 'h-2.5 w-2.5' },
    md: { box: 'h-4 w-4', icon: 'h-3 w-3' },
    lg: { box: 'h-5 w-5', icon: 'h-3.5 w-3.5' },
} as const;

export interface CheckboxProps extends Omit<
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    'color'
> {
    /** Checked-state color (default `primary`). Accepts any palette/custom slot. */
    color?: ColorKey | (string & {});
    size?: keyof typeof SIZES;
}

// Radix control — the checked fill is driven off a per-instance `--sx-sel`
// custom property set to the silicaui color token (default primary), so the
// accent follows the theme without a role-var recipe.
export const Checkbox = React.forwardRef<
    React.ElementRef<typeof CheckboxPrimitive.Root>,
    CheckboxProps
>(({ className, color = 'primary', size = 'md', style, ...props }, ref) => {
    const s = SIZES[size];
    const { sel, selFg } = colorVars(color);
    return (
        <CheckboxPrimitive.Root
            ref={ref}
            style={{ ['--sx-sel']: sel, ['--sx-sel-fg']: selFg, ...style } as React.CSSProperties}
            className={cn(
                'peer inline-flex shrink-0 items-center justify-center rounded-sm border',
                s.box,
                'border-base-300 bg-base-100',
                'transition-colors duration-150',
                'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'data-[state=checked]:border-[var(--sx-sel)] data-[state=checked]:bg-[var(--sx-sel)] data-[state=checked]:text-[var(--sx-sel-fg)]',
                'data-[state=indeterminate]:border-[var(--sx-sel)] data-[state=indeterminate]:bg-[var(--sx-sel)] data-[state=indeterminate]:text-[var(--sx-sel-fg)]',
                className
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator className="flex items-center justify-center">
                {props.checked === 'indeterminate' ? (
                    <Minus className={s.icon} strokeWidth={3} />
                ) : (
                    <Check className={s.icon} strokeWidth={3} />
                )}
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
});
Checkbox.displayName = 'Checkbox';
