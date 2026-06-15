// Live Chat — module gate + color for everything under /chat/* (the overview at
// /chat and the two-pane inbox at /chat/inbox). The inbox shell (socket +
// conversation list) now lives in chat/inbox/layout.tsx so the overview can
// render full-width; this layer only gates the module and supplies its Violet
// accent via ModuleProvider.

import { ModuleProvider } from '@sparx/ui';

import { ModuleGate } from '@/components/module-gate';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGate module="chat">
      <ModuleProvider module="chat">{children}</ModuleProvider>
    </ModuleGate>
  );
}
