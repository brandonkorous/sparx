'use client';

import { ChunkReloadGuard } from '@wizeworks/app-kit';
import { ConfirmProvider, Toaster, TooltipProvider } from '@wizeworks/ui';

// Minimal client provider stack for the operator console. No QueryProvider yet —
// Slice 1 fetches server-side; add it when a client-data surface lands.
// ChunkReloadGuard reloads a tab left open across a release, once, instead of
// letting its next click on a purged chunk or a gone server action crash it.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <ChunkReloadGuard />
      <ConfirmProvider>{children}</ConfirmProvider>
      <Toaster />
    </TooltipProvider>
  );
}
