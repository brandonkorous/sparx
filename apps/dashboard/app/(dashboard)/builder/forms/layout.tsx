import { ModuleProvider } from '@sparx/ui';

// Form submissions is a Builder-module surface (docs/115). The builder module
// GATE already runs in the parent builder/layout.tsx (`<ModuleGate
// module="builder">`), which deliberately omits a ModuleProvider so the
// full-height editor shell isn't wrapped in an extra block. These inbox pages
// are ordinary document-flow pages, so they add their own ModuleProvider here to
// wear the Builder indigo — the chrome tint + the page-level primary action.
export default function FormsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleProvider module="builder" className="flex h-full min-h-0 flex-col">
      {children}
    </ModuleProvider>
  );
}
