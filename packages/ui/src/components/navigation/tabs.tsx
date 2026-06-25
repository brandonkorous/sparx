'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from '../../utils/cva';
import { cn } from '../../utils/cn';

// Variant lives on the List so a single Tabs can opt in/out of the pill style.
// The active tab (either variant) routes its indicator/text through
// --module-active so a wrapping ModuleProvider tints the current selection.

export const Tabs = TabsPrimitive.Root;

// Pills is the house default (a neutral segmented control) — box tabs read as
// AI slop, so they're not an option. The list spans the full width (`w-full`):
// the pill track / underline rule runs edge-to-edge of its container, and it
// WRAPS to additional rows when the tabs can't fit one line (e.g. an 8-tab
// product detail in a narrow drawer) so every tab stays visible — never clipped
// off-screen or stranded behind a hidden scrollbar. Responsive at any width.
const tabsListVariants = cva('flex w-full flex-wrap items-center', {
  variants: {
    variant: {
      default: 'gap-x-4 gap-y-1 border-b border-[var(--color-border-default)]',
      pills: 'gap-x-1 gap-y-1 rounded-md bg-[var(--color-bg-subtle)] p-1',
    },
  },
  defaultVariants: { variant: 'pills' },
});

type TabsListVariant = NonNullable<VariantProps<typeof tabsListVariants>['variant']>;
type TabsSize = 'sm' | 'md' | 'lg';
const TabsListContext = React.createContext<{ variant: TabsListVariant; size: TabsSize }>({
  variant: 'pills',
  size: 'md',
});

export interface TabsListProps
  extends
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {
  size?: TabsSize;
}

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant = 'pills', size = 'md', children, ...props }, ref) => (
  <TabsListContext.Provider value={{ variant: variant ?? 'pills', size }}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  </TabsListContext.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const SIZE_DEFAULT: Record<TabsSize, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-4 text-base',
};
const SIZE_PILLS: Record<TabsSize, string> = {
  sm: 'h-6 px-2.5 text-xs',
  md: 'h-7 px-3 text-sm',
  lg: 'h-9 px-4 text-base',
};

function triggerClasses(variant: TabsListVariant, size: TabsSize): string {
  if (variant === 'pills') {
    return cn(
      'inline-flex shrink-0 items-center rounded-sm font-medium whitespace-nowrap',
      SIZE_PILLS[size],
      'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
      'transition-colors duration-150',
      'focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:outline-none',
      'disabled:pointer-events-none disabled:opacity-40',
      // Active pill: white surface lift + the module hue on the label, so the
      // current selection carries the active-module color (DESIGN.md) instead of
      // a flat neutral.
      'data-[state=active]:bg-[var(--color-bg-surface)] data-[state=active]:text-[var(--module-active-text)] data-[state=active]:shadow-sm'
    );
  }
  return cn(
    'relative -mb-px inline-flex shrink-0 items-center font-medium whitespace-nowrap',
    SIZE_DEFAULT[size],
    'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
    'border-b-2 border-transparent transition-colors duration-150',
    'focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:outline-none',
    'disabled:pointer-events-none disabled:opacity-40',
    'data-[state=active]:border-[var(--module-active)] data-[state=active]:text-[var(--module-active-text)]'
  );
}

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const { variant, size } = React.useContext(TabsListContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(triggerClasses(variant, size), className)}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:outline-none',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { tabsListVariants };
