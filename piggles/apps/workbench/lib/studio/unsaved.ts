'use client';

// Unsaved studio work, seen from outside the panes.
//
// Each builder pane already declares its own dirtiness (`useDirtySource`), which
// covers every close path the console controls. This covers the one it does not: a
// document can be UNSAVED WITH NO PANE OPEN.
//
// That is deliberate, not a leak. The session holds documents so a pane can close
// and reopen — or be torn into its own window — without losing the draft. The cost
// is that the pane which was speaking for that draft is gone, so nothing else knows
// it exists. Closing the browser would then throw it away in silence, which is the
// one outcome this whole per-document design exists to prevent.

import { useEffect } from 'react';
import type { StudioSession } from '@wizeworks/studio';
import { useWorkbench } from '../workbench/context';

export function useStudioUnloadGuard(session: StudioSession | null): void {
  const { controller } = useWorkbench();

  useEffect(() => {
    if (!session) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // A site or business switch reloads on purpose after its own consent dialog;
      // prompting again cancels the reload and half-applies the switch.
      if (controller.isUnloadIntentional()) return;
      if (!session.hasUnsavedWork) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [controller, session]);
}
