'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../utils/cn';

export const TooltipProvider = TooltipPrimitive.Provider;

// Tooltip Root — self-contained: each instance carries its OWN Provider so a
// trigger never throws "Tooltip must be used within TooltipProvider", no matter
// where it mounts (overlay portals, the SurfaceFrame, the builder canvas, a
// detached subtree). A shared <TooltipProvider> higher up (the app layout) still
// works — nested Radix providers are a no-op for the inner subtree — but it's no
// longer load-bearing for correctness. Mirrors @sparx/site-ui's Tooltip, which
// already does this. `delayDuration` defaults to 150ms (the app's house value)
// and an explicit prop still wins.
export function Tooltip({
  delayDuration = 150,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root delayDuration={delayDuration} {...props} />
    </TooltipPrimitive.Provider>
  );
}

export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 max-w-xs rounded-md px-2.5 py-1.5 text-xs',
        'text-base-100 bg-base-content',
        'shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
        'data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;
