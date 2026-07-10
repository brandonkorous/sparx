'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../utils/cn';
import { colorVars, type ColorKey } from '../_recipes/variants';

export interface SliderProps extends Omit<
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
    'color'
> {
    /** Range/thumb color (default `module` — adopts the wrapping ModuleProvider
     *  color, preserving prior behaviour). Accepts any palette/custom slot. */
    color?: ColorKey | (string & {});
}

// Radix control — the filled range and thumb are driven off a per-instance
// `--sx-sel` custom property set to the silicaui color token (default module).
export const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
    ({ className, color = 'module', style, ...props }, ref) => {
        // Multi-thumb sliders pass `value` as number[]; default to a single thumb
        // when the consumer didn't provide one explicitly.
        const value = props.value ?? props.defaultValue ?? [0];
        const { sel } = colorVars(color);

        return (
            <SliderPrimitive.Root
                ref={ref}
                style={{ ['--sx-sel']: sel, ...style } as React.CSSProperties}
                className={cn(
                    'relative flex w-full touch-none items-center select-none',
                    'data-[disabled]:opacity-50',
                    className
                )}
                {...props}
            >
                <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-base-300">
                    <SliderPrimitive.Range className="absolute h-full bg-[var(--sx-sel)]" />
                </SliderPrimitive.Track>
                {value.map((_, i) => (
                    <SliderPrimitive.Thumb
                        key={i}
                        className={cn(
                            'block h-4 w-4 rounded-full border-2 border-[var(--sx-sel)] bg-base-100',
                            'transition-colors duration-150',
                            'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:outline-none',
                            'disabled:pointer-events-none disabled:opacity-50'
                        )}
                    />
                ))}
            </SliderPrimitive.Root>
        );
    }
);
Slider.displayName = SliderPrimitive.Root.displayName;
