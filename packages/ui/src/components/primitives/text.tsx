import * as React from 'react';
import { cva, type VariantProps } from '../../utils/cva';
import { cn } from '../../utils/cn';

const textVariants = cva('', {
  variants: {
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    },
    variant: {
      default: 'text-base-content',
      muted: 'text-base-content/70',
      subtle: 'text-base-content/50',
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
