'use client';

import * as React from 'react';
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu';
import { ChevronDown } from 'lucide-react';
import { cva } from '../../utils/cva';
import { cn } from '../../utils/cn';

/**
 * NavigationMenu — Radix navigation-menu wrapper for header nav and megamenus.
 *
 * Unlike DropdownMenu (a command menu: `menuitem` roles, click-only), this is
 * built for a bar of nav links where one or more items open a rich content
 * panel on hover/focus, with proper `nav`/link semantics and keyboard support.
 *
 * Two layout modes:
 *  - `viewport` (default): a single shared, size-animating panel container,
 *    centered under the list — best when several triggers share one panel.
 *  - `viewport={false}`: each Content renders positioned under its own Item —
 *    simpler when a single trigger owns one panel (e.g. a marketing megamenu
 *    that styles the panel itself).
 *
 * Visual defaults are token-based for dashboard use; every part forwards
 * `className`/`style`, so a consumer can fully restyle (the marketing header
 * does exactly that).
 */
export const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root> & {
    /** Render the shared, size-animating viewport panel. Default: true. */
    viewport?: boolean;
  }
>(({ className, children, viewport = true, ...props }, ref) => (
  <NavigationMenuPrimitive.Root
    ref={ref}
    data-viewport={viewport}
    className={cn('relative flex max-w-max flex-1 items-center justify-center', className)}
    {...props}
  >
    {children}
    {viewport ? <NavigationMenuViewport /> : null}
  </NavigationMenuPrimitive.Root>
));
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName;

export const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn('group flex flex-1 list-none items-center justify-center gap-1', className)}
    {...props}
  />
));
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName;

export const NavigationMenuItem = NavigationMenuPrimitive.Item;

export const navigationMenuTriggerStyle = cva(
  cn(
    'group inline-flex h-9 w-max items-center justify-center gap-1 rounded-md px-3 py-2',
    'text-sm font-medium transition-colors',
    'hover:focus:outline-none',
    'focus-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    'data-[state=open]:'
  )
);

export const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(navigationMenuTriggerStyle(), className)}
    {...props}
  >
    {children}{' '}
    <ChevronDown
      className="relative top-px h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
      aria-hidden
    />
  </NavigationMenuPrimitive.Trigger>
));
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;

export const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      'top-0 left-0 w-full',
      'data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out',
      'data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out',
      'data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52',
      'data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52',
      // Without the shared viewport, the consumer positions the panel (the
      // marketing megamenu passes `absolute top-full` styling itself).
      className
    )}
    {...props}
  />
));
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName;

export const NavigationMenuLink = NavigationMenuPrimitive.Link;

export const NavigationMenuViewport = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <div className="absolute top-full left-0 isolate z-50 flex justify-center">
    <NavigationMenuPrimitive.Viewport
      ref={ref}
      className={cn(
        'relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-[var(--radix-navigation-menu-viewport-width)] origin-[top_center] overflow-hidden rounded-lg',
        'border-base-300 bg-base-100 border shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90',
        className
      )}
      {...props}
    />
  </div>
));
NavigationMenuViewport.displayName = NavigationMenuPrimitive.Viewport.displayName;

export const NavigationMenuIndicator = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Indicator>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Indicator>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Indicator
    ref={ref}
    className={cn(
      'top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden',
      'data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in',
      className
    )}
    {...props}
  >
    <div className="bg-base-300 relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm" />
  </NavigationMenuPrimitive.Indicator>
));
NavigationMenuIndicator.displayName = NavigationMenuPrimitive.Indicator.displayName;
