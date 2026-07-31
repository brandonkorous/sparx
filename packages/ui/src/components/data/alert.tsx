import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { type ColorKey } from '../_recipes/variants';

// Alert — inline status banner on the shared color axis (docs/35 Tier-A),
// composed from silicaui's `.alert` component classes (which own the fill /
// border / radius / padding). The icon, title, body and dismiss affordance are
// sparx-specific and layered on top.

const ALERT_VARIANT = { solid: '', soft: 'alert-soft', outline: 'alert-outline' } as const;
const ALERT_SIZE = { sm: 'alert-sm', md: 'alert-md', lg: 'alert-lg' } as const;

export type AlertVariant = keyof typeof ALERT_VARIANT;
export type AlertSize = keyof typeof ALERT_SIZE;

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color' | 'title'> {
  /** Semantic color slot (known slots autocomplete; any string accepted for
   *  runtime custom theme colors). Defaults to `info`. */
  color?: ColorKey | (string & {});
  variant?: AlertVariant;
  size?: AlertSize;
  /** Leading icon (e.g. a Lucide icon). Inherits the alert's text color. */
  icon?: React.ReactNode;
  /** Bold heading line above the body. */
  title?: React.ReactNode;
  /** When provided, renders a dismiss button. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      color = 'info',
      variant = 'soft',
      size = 'md',
      icon,
      title,
      onDismiss,
      dismissLabel = 'Dismiss',
      children,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'alert',
        `alert-${color}`,
        ALERT_VARIANT[variant],
        ALERT_SIZE[size],
        'flex',
        className
      )}
      {...props}
    >
      {icon && <span className="mt-0.5 shrink-0 [&>svg]:h-[1.1em] [&>svg]:w-[1.1em]">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={onDismiss}
          className={cn(
            '-mt-0.5 -mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm',
            'opacity-60 hover:opacity-100',
            'focus-ring'
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
);
Alert.displayName = 'Alert';
