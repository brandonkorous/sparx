import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../utils/cn';

// Stepper for multi-step flows (onboarding, checkout). Renders horizontal
// indicators with completed/current/pending states. Active step uses
// --module-active so it tints with a wrapping ModuleProvider.

export interface StepperStep {
  label: string;
  description?: string;
}

export interface StepperProps extends React.HTMLAttributes<HTMLOListElement> {
  steps: StepperStep[];
  /** Zero-indexed current step. */
  current: number;
}

export const Stepper = React.forwardRef<HTMLOListElement, StepperProps>(
  ({ className, steps, current, ...props }, ref) => (
    <ol
      ref={ref}
      aria-label="Progress"
      className={cn('flex w-full items-start gap-2', className)}
      {...props}
    >
      {steps.map((step, idx) => {
        const status: 'complete' | 'current' | 'upcoming' =
          idx < current ? 'complete' : idx === current ? 'current' : 'upcoming';
        const isLast = idx === steps.length - 1;

        return (
          <li
            key={`${idx}-${step.label}`}
            className={cn('flex flex-1 flex-col gap-1.5', !isLast && 'pr-2')}
            aria-current={status === 'current' ? 'step' : undefined}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                  'transition-colors duration-150',
                  status === 'complete' && 'border-module bg-module text-white',
                  status === 'current' && 'border-module bg-module bg-soft text-module',
                  status === 'upcoming' && 'text-base-content/50 border-[var(--color-base-300)]'
                )}
              >
                {status === 'complete' ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </span>
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    'h-px flex-1',
                    status === 'complete' ? 'bg-module' : 'bg-[var(--color-base-300)]'
                  )}
                />
              )}
            </div>
            <div className="pr-2">
              <p
                className={cn(
                  'text-xs leading-tight font-medium',
                  status === 'current' ? 'text-base-content' : 'text-base-content/70'
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="text-base-content/50 mt-0.5 text-xs">{step.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  )
);
Stepper.displayName = 'Stepper';
