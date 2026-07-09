'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { type ColorKey } from '../_recipes/variants';

// Tag is the removable-chip cousin of Badge — used for active filters, applied
// labels, multi-select pills. Same color × variant × size axes (docs/35), plus
// an inline remove button. It keeps a squarer `rounded-sm` shape (vs Badge's
// pill), so it wears its color via silicaui's universal color utilities +
// `bg-soft` treatment rather than the `.badge` component class.

const TAG_SIZE = {
  sm: 'px-1.5 py-0.5 text-[0.625rem]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
} as const;

/** color × treatment → silicaui utility classes (dynamic names resolve against
 *  the plugin's statically-emitted color utilities). */
function tagTone(color: string, variant: 'solid' | 'soft' | 'outline'): string {
  switch (variant) {
    case 'solid':
      return `bg-${color} text-${color}-content`;
    case 'outline':
      return `border border-${color} text-${color}`;
    case 'soft':
    default:
      return `bg-${color} bg-soft text-${color}`;
  }
}

export type TagVariant = 'solid' | 'soft' | 'outline';
export type TagSize = keyof typeof TAG_SIZE;

export interface TagProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  /** Semantic color slot (known slots autocomplete; any string accepted for
   *  runtime custom theme colors). Defaults to `neutral`. */
  color?: ColorKey | (string & {});
  variant?: TagVariant;
  size?: TagSize;
  /** When provided, shows an inline remove button. */
  onRemove?: () => void;
  removeLabel?: string;
}

export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(
  (
    {
      className,
      color = 'neutral',
      variant = 'soft',
      size = 'md',
      onRemove,
      removeLabel = 'Remove',
      children,
      ...props
    },
    ref
  ) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm font-medium',
        tagTone(color, variant),
        TAG_SIZE[size],
        className
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className={cn(
            'ml-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm',
            'opacity-70 hover:opacity-100',
            'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none'
          )}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
);
Tag.displayName = 'Tag';
