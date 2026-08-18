'use client';

// A tree builder pane — layout, page or component, whole and self-contained.
//
// One pane holds everything that builder needs: its layers, its Insert palette,
// its canvas and its Inspector. That is the point of the shape. Splitting the
// rails into dockable panes of their own sounds like more freedom and is less:
// dragging a block from a palette in one window onto a canvas in another is a
// cross-document drag, which does not work, and every rail then has to answer
// "which canvas am I for".
//
// Save and Publish are the APP's — the package has no endpoints and no opinion
// about them — so they arrive through `toolbar`. What the pane owns is the device
// it is showing, the shortcuts, and the arrangement.
//
// On a narrow screen the three columns become one, switched by a bar at the
// bottom. Not hidden: a rail that only exists above 1024px means the builder is
// desktop-only, and the whole platform's rule is that it isn't.

import { useRef, useState, type ReactNode } from 'react';
import { Button, TabsList, TabsTab } from '@wizeworks/silicaui-react';
import type { TreeDoc } from '../../documents/types';
import { useDocSnapshot, useDocumentStore } from '../context';
import { Canvas, type CanvasDevice } from '../canvas/canvas';
import { Inspector } from '../inspector/inspector';
import { Navigator } from '../navigator/navigator';
import { Palette } from '../palette/palette';
import { StudioIcon } from '../icon';
import { FillTabs, FillTabsPanel } from '../fill-tabs';
import { useBuilderShortcuts } from './shortcuts';

const DEVICES: { value: CanvasDevice; label: string; icon: string }[] = [
  { value: 'mobile', label: 'Phone', icon: 'smartphone' },
  { value: 'tablet', label: 'Tablet', icon: 'tablet' },
  { value: 'desktop', label: 'Computer', icon: 'monitor' },
];

/** Which single column a narrow screen is showing. */
type NarrowView = 'canvas' | 'rail' | 'inspector';

const NARROW_VIEWS: { value: NarrowView; label: string; icon: string }[] = [
  { value: 'rail', label: 'Add & layers', icon: 'plus' },
  { value: 'canvas', label: 'Page', icon: 'page' },
  { value: 'inspector', label: 'Change', icon: 'sliders' },
];

/** Visible on wide screens always; on narrow ones only when it is the chosen view. */
function column(active: boolean, wide: string): string {
  return `${active ? 'flex' : 'hidden'} ${wide}`;
}

export function TreeBuilder({
  toolbar,
  statusBar,
}: {
  /** The app's own actions — Save, Preview, Publish. */
  toolbar?: ReactNode;
  /** The app's own state — saved/unsaved, what is live. */
  statusBar?: ReactNode;
}) {
  const store = useDocumentStore<TreeDoc>();
  const { canUndo, canRedo } = useDocSnapshot();
  const paneRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<CanvasDevice>('desktop');
  const [rail, setRail] = useState('layers');
  const [view, setView] = useState<NarrowView>('canvas');

  useBuilderShortcuts(paneRef, store);

  return (
    // `tabIndex` so the pane can hold focus and its shortcuts stay its own — a
    // window-level listener would let ⌘Z here undo an edit in another pane.
    <div ref={paneRef} tabIndex={-1} className="flex h-full min-h-0 flex-col outline-none">
      <div className="border-base-300 flex shrink-0 flex-wrap items-center gap-2 border-b px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          {DEVICES.map((option) => (
            <Button
              key={option.value}
              size="sm"
              shape="square"
              aria-label={option.label}
              title={option.label}
              {...(device === option.value ? { color: 'primary' as const } : {})}
              onClick={() => setDevice(option.value)}
            >
              <StudioIcon name={option.icon} className="inline-flex size-4" />
            </Button>
          ))}
        </div>

        <div className="bg-base-300 mx-1 h-5 w-px" aria-hidden />

        {/* Secondary chrome: neither `color` nor `variant`, so a bare `.btn`
            resolves to `base-content` and stays theme-correct in both modes. */}
        <Button
          size="sm"
          shape="square"
          aria-label="Undo"
          title="Undo"
          disabled={!canUndo}
          onClick={() => store.undo()}
        >
          <StudioIcon name="undo" className="inline-flex size-4" />
        </Button>
        <Button
          size="sm"
          shape="square"
          aria-label="Redo"
          title="Redo"
          disabled={!canRedo}
          onClick={() => store.redo()}
        >
          <StudioIcon name="redo" className="inline-flex size-4" />
        </Button>

        <div className="ml-auto flex items-center gap-2">{toolbar}</div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className={column(
            view === 'rail',
            'border-base-300 w-full shrink-0 flex-col lg:flex lg:w-64 lg:border-r'
          )}
        >
          <FillTabs value={rail} onValueChange={setRail}>
            <TabsList className="px-2 pt-2">
              <TabsTab value="layers">Layers</TabsTab>
              <TabsTab value="insert">Insert</TabsTab>
            </TabsList>
            <FillTabsPanel value="layers">
              <Navigator />
            </FillTabsPanel>
            <FillTabsPanel value="insert">
              <Palette />
            </FillTabsPanel>
          </FillTabs>
        </aside>

        <main className={column(view === 'canvas', 'min-h-0 min-w-0 flex-1 flex-col lg:flex')}>
          <Canvas device={device} />
        </main>

        <aside
          className={column(
            view === 'inspector',
            'border-base-300 w-full shrink-0 flex-col lg:flex lg:w-72 lg:border-l'
          )}
        >
          <Inspector device={device} />
        </aside>
      </div>

      <div className="border-base-300 flex shrink-0 items-center gap-1 border-t p-1 lg:hidden">
        {NARROW_VIEWS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            className="flex-1"
            {...(view === option.value ? { color: 'primary' as const } : {})}
            onClick={() => setView(option.value)}
          >
            <StudioIcon name={option.icon} className="inline-flex size-4" />
            {option.label}
          </Button>
        ))}
      </div>

      {statusBar ? (
        <div className="border-base-300 text-base-content flex shrink-0 items-center gap-2 border-t px-3 py-1 text-xs">
          {statusBar}
        </div>
      ) : null}
    </div>
  );
}
