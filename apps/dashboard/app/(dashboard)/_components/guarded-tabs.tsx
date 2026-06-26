'use client';

import * as React from 'react';

import { Tabs } from '@sparx/ui';

import { useLeaveGuard } from './unsaved-guard';

// A `<Tabs>` that consults the active form's unsaved-changes guard BEFORE
// switching away from a tab (docs/105 — extends the dirty-state guard to tabbed
// details). On a tabbed detail page the editable panel in the current tab
// registers its guard via `useUnsavedGuard`; switching tabs with unsaved edits
// would otherwise unmount the panel and silently drop them. Here the tab change
// routes through `useLeaveGuard()` first — a clean tab switches immediately, a
// dirty one prompts the discard confirm and only switches if the user accepts.
//
// Drop-in for the `@sparx/ui` `<Tabs>` on any detail whose content is wrapped in
// an `<UnsavedGuardProvider>` (the overlay host already provides one; the
// full-page route wraps itself, like the category detail page). It self-manages
// the active value so callers keep passing `defaultValue` exactly as before.
type TabsProps = React.ComponentPropsWithoutRef<typeof Tabs>;

export interface GuardedTabsProps extends Omit<TabsProps, 'value' | 'onValueChange'> {
  /** Initial tab (same contract as `<Tabs defaultValue>`). */
  defaultValue: string;
}

export function GuardedTabs({ defaultValue, children, ...props }: GuardedTabsProps) {
  const runGuard = useLeaveGuard();
  const [value, setValue] = React.useState(defaultValue);

  const onValueChange = React.useCallback(
    (next: string) => {
      // Radix calls this synchronously; gate the controlled value update behind
      // the guard so the tab only changes once leaving the current one is safe.
      void Promise.resolve(runGuard()).then((ok) => {
        if (ok) setValue(next);
      });
    },
    [runGuard]
  );

  return (
    <Tabs value={value} onValueChange={onValueChange} {...props}>
      {children}
    </Tabs>
  );
}
