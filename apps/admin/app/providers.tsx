'use client';

import { ConfirmProvider, Toaster, TooltipProvider } from '@sparx/ui';

// Minimal client provider stack for the operator console. No QueryProvider yet —
// Slice 1 fetches server-side; add it when a client-data surface lands.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <ConfirmProvider>{children}</ConfirmProvider>
      <Toaster />
    </TooltipProvider>
  );
}
