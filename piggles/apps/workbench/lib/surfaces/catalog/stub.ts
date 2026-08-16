// Declares a nav row whose screen isn't built yet.
//
// The registry is the nav (see ../nav.ts), so a module's navigation can only be
// complete once every one of its surfaces is registered. This wraps the
// placeholder component so an unbuilt row costs four lines instead of ten, and —
// more importantly — so every unbuilt row is greppable as one call. When a real
// screen lands, `stub(...)` becomes a normal entry and nothing else changes:
// same key, so saved layouts and deep links survive the swap.

import type { PigglesIcon } from '@piggles/ui';
import type { SurfaceDefinition } from '../registry';
import type { WorkbenchModule } from '../../../components/module-scope';
import { createPlaceholderSurface } from '../../../surfaces/placeholder';

interface StubOptions {
  key: string;
  title: string;
  module: WorkbenchModule;
  icon: PigglesIcon;
  /** What this screen is for, in plain language. Shown in the pane. */
  body: string;
  section?: string;
  order?: number;
  keywords?: readonly string[];
}

export function stub({ key, title, module, icon, body, ...rest }: StubOptions): SurfaceDefinition {
  return {
    key,
    title,
    module,
    icon,
    ...rest,
    component: createPlaceholderSurface({ icon, title, body }),
  };
}
