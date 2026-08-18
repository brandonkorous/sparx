'use client';

// A tab set that FILLS its pane, so its panel can scroll.
//
// WHY THIS EXISTS, because the failure is invisible and cost a browser session to
// find. silica's `.tabs` root is `display: block` — deliberately, "just a flow
// container", which is right for an ordinary tab set in the middle of a page. A
// block's children are not flex items, so `flex-1` on a `<TabsPanel>` is INERT: the
// panel takes its content's height, nothing below it is ever constrained, and an
// `overflow-auto` further down has no bounded box to scroll inside.
//
// Everything looks correct until there is more content than fits. Then the rail
// simply runs off the bottom of the pane with no scrollbar — which is what the
// Layers rail did, on a layout with enough nodes to overflow.
//
// So the fix is layout utilities on the root (sanctioned — this is arrangement, not
// re-skinning), and it lives HERE rather than at each call site because there are
// three rails with identical markup and the next one would get it wrong too.

import { Tabs, TabsPanel } from '@wizeworks/silicaui-react';
import type { ReactNode } from 'react';

export function FillTabs({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      variant="pills"
      // `flex flex-col` is the whole point — see this file's header. `min-h-0`
      // lets it shrink below its content, which is what allows a child to scroll
      // rather than pushing the pane taller.
      className="flex min-h-0 flex-1 flex-col"
    >
      {children}
    </Tabs>
  );
}

/**
 * One panel of a {@link FillTabs}.
 *
 * By default it hands its height to whatever is inside — for a rail that owns its
 * own scroller. Pass `scrolls` when the panel itself is the scrolling box.
 */
export function FillTabsPanel({
  value,
  scrolls,
  children,
}: {
  value: string;
  scrolls?: boolean;
  children: ReactNode;
}) {
  return (
    <TabsPanel
      value={value}
      className={`flex min-h-0 flex-1 flex-col ${scrolls ? 'overflow-auto' : 'overflow-hidden'}`}
    >
      {children}
    </TabsPanel>
  );
}
