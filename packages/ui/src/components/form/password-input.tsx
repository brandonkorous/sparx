'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './input';
import { cn } from '../../utils/cn';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  /** Accessible label for the reveal control while the password is hidden. */
  showLabel?: string;
  /** Accessible label while the password is shown. */
  hideLabel?: string;
}

// A password <Input> with an inline reveal toggle — the eye affordance users
// expect. The toggle is icon-only chrome (no background fill), so it's a control
// affordance, not a re-skinned button. It stays keyboard-reachable for a11y.
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showLabel = 'Show password', hideLabel = 'Hide password', ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          // Reserve room so masked text never runs under the toggle.
          className={cn('pr-10', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className={cn(
            'absolute inset-y-0 right-0 flex items-center rounded-r-md px-3',
            'text-base-content transition-colors',
            'hover:text-base-content',
            'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none'
          )}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';
