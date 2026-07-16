'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { cn } from '../../utils/cn';

// Styled wrapper around react-day-picker v10. Selected day adopts
// --module-active so it tints inside a ModuleProvider.

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'flex flex-col gap-3',
        month_caption: 'relative flex h-7 items-center justify-center',
        caption_label: 'text-sm font-medium text-base-content',
        nav: 'absolute inset-x-0 top-3 flex items-center justify-between px-3',
        button_previous: cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md',
          'border-base-300 bg-base-100 border',
          'text-base-content hover:text-base-content hover:bg-base-200',
          'transition-colors duration-150',
          'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
          'disabled:pointer-events-none disabled:opacity-40'
        ),
        button_next: cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md',
          'border-base-300 bg-base-100 border',
          'text-base-content hover:text-base-content hover:bg-base-200',
          'transition-colors duration-150',
          'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none',
          'disabled:pointer-events-none disabled:opacity-40'
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'flex-1 text-center text-xs font-medium uppercase tracking-wider text-base-content pb-2',
        week: 'flex w-full mt-1',
        day: cn(
          'relative flex flex-1 items-center justify-center p-0 text-sm',
          'focus-within:relative focus-within:z-20'
        ),
        day_button: cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md text-sm',
          'text-base-content',
          'transition-colors duration-150',
          'hover:bg-base-200',
          'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none'
        ),
        selected: '[&_button]:bg-module [&_button]:text-white [&_button]:hover:bg-module',
        today: '[&_button]:bg-base-200 [&_button]:font-medium [&_button]:text-base-content',
        outside: '[&_button]:text-base-content [&_button]:opacity-50',
        disabled: '[&_button]:pointer-events-none [&_button]:opacity-40',
        range_middle: '[&_button]:bg-module/10 [&_button]:text-module',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';
