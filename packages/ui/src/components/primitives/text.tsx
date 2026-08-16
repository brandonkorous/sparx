import * as React from 'react';
import { cva, type VariantProps } from '../../utils/cva';
import { cn } from '@wizeworks/silica-corrections';

const textVariants = cva('', {
  variants: {
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    },
    // Text that is meant to be READ is `text-base-content`. `muted` and `subtle`
    // used to fade it to /70 and /50 — but opacity is a filter, not a color: it
    // composites against whatever is behind it, so the ink drifted per module on a
    // tinted card and went near-invisible on the neutral inverse panel. Both now
    // resolve to the real ink; rank is carried by `size` and `weight`, never by
    // making the words harder to see. (Kept as variant names so ~570 call sites
    // don't churn — they're aliases now, not a fading scale.)
    variant: {
      default: '',
      muted: '',
      subtle: '',
      inverse: 'text-base-100',
      danger: 'text-danger',
      warning: 'text-warning',
      success: 'text-success',
    },
    weight: {
      regular: 'font-normal',
      medium: 'font-medium',
    },
  },
  defaultVariants: {
    // Body text defaults to 16px (`text-base`). Captions/secondary text opt DOWN
    // with size="sm" (14px) — never let unspecified body fall below the 16px floor.
    size: 'md',
    variant: 'default',
    weight: 'regular',
  },
});

type TextTag = 'p' | 'span' | 'div' | 'label';

export interface TextProps
  extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof textVariants> {
  as?: TextTag;
  htmlFor?: string;
}

export const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ className, size, variant, weight, as = 'p', children, ...props }, ref) => {
    const Tag = as as 'p';
    return (
      <Tag
        ref={ref as React.Ref<HTMLParagraphElement>}
        className={cn(textVariants({ size, variant, weight }), className)}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);
Text.displayName = 'Text';

export { textVariants };
