'use client';

// The Inspector rail.
//
// Its header IS the tab strip. A fixed "Properties" title above the tabs would
// duplicate the first tab's name and then contradict the second — the open tab is
// the only honest answer to "what is this panel".
//
// Nothing selected is a real state with a real answer, not a blank rail: it says
// what to do next, because the one thing an author who has just opened the editor
// does not know is that they are supposed to click the page first.

import { useState } from 'react';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@wizeworks/silicaui-react';
import { useSelectedNode } from '../context';
import type { CanvasDevice } from '../canvas/canvas';
import { rowLabel } from '../navigator/layer-tree';
import { DesignTab } from './design-tab';
import { SettingsTab } from './settings-tab';

export function Inspector({ device }: { device: CanvasDevice }) {
  const node = useSelectedNode();
  const [tab, setTab] = useState('design');

  if (!node) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-base-content text-sm">
          Click anything on your page to change how it looks.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-base-300 border-b px-3 py-2">
        <p className="text-base-content truncate text-sm font-medium">{rowLabel(node)}</p>
      </div>
      {/* Pills: a filled shape says "you are here" before the label is read. */}
      <Tabs value={tab} onValueChange={setTab} variant="pills" className="min-h-0 flex-1">
        <TabsList className="px-3 pt-2">
          <TabsTab value="design">Design</TabsTab>
          <TabsTab value="settings">Settings</TabsTab>
        </TabsList>
        <TabsPanel value="design" className="min-h-0 flex-1 overflow-auto">
          <DesignTab node={node} device={device} />
        </TabsPanel>
        <TabsPanel value="settings" className="min-h-0 flex-1 overflow-auto">
          <SettingsTab node={node} />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
