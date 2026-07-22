'use client';

import * as React from 'react';
import { cva, type VariantProps } from '../../utils/cva';
import { cn } from '../../utils/cn';

const textareaVariants = cva(
  [
    'bg-base-100 flex w-full rounded-md border px-3 py-2',
    'text-base-content text-sm',
    'placeholder:text-base-content',
    'transition-colors duration-150',
    'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'resize-y',
  ],
  {
    variants: {
      variant: {
        default:
          'border-base-300 hover:border-[color-mix(in_oklab,var(--color-base-content)_30%,transparent)]',
        error: 'border-danger focus-visible:ring-[var(--color-danger)]',
        success: 'border-success focus-visible:ring-[var(--color-success)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface TextareaProps
  extends
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(textareaVariants({ variant }), className)}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { textareaVariants };
