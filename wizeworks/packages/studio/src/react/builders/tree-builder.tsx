'use client';

// A tree builder pane — layout, page or component, whole and self-contained.
//
// One pane holds everything that builder needs: its layers, its Insert palette, its
// canvas and its Inspector. That is the point of the shape. Splitting the rails into
// dockable panes of their own sounds like more freedom and is less: dragging a block
// from a palette in one window onto a canvas in another is a cross-document drag,
// which does not work, and every rail then has to answer "which canvas am I for".
//
// Save and Publish are the APP's — the package has no endpoints and no opinion about
// them — so they arrive through the toolbar's slots. What the pane owns is the
// device it is showing, the palette it is drawn in, the shortcuts, and the
// arrangement.
//
// Everything here measures the PANE, never the viewport (`@container/builder`). The
// same builder is narrow on a phone and narrow docked beside a second one on a 27"
// monitor, and it has to behave identically in both. On a narrow pane the three
// columns become one, switched by a bar at the bottom, and the toolbar folds what
// this pane OFFERS into a popover while keeping what it IS — the device, the
// palette, undo, and the Save — in the bar. builder-toolbar.tsx on that split.

import { useRef, useState, type ReactNode } from 'react';
import { TabsList, TabsTab } from '@wizeworks/silicaui-react';
import type { TreeDoc } from '../../documents/types';
import { useDocumentStore } from '../context';
import { Canvas, type CanvasDevice } from '../canvas/canvas';
import { PointerDragProvider } from '../drag/pointer-drag';
import type { StudioMode } from '../mode-switch';
import { Inspector } from '../inspector/inspector';
import { Navigator } from '../navigator/navigator';
import { Palette } from '../palette/palette';
import { FillTabs, FillTabsPanel } from '../fill-tabs';
import { useBuilderShortcuts } from './shortcuts';
import { BuilderToolbar, type BuilderAction } from './builder-toolbar';
import { NarrowViewBar, type NarrowViewOption } from './narrow-view-bar';
import { useBuilderFit } from './use-builder-fit';

const DEVICES = [
  { value: 'mobile', label: 'Phone', icon: 'smartphone' },
  { value: 'tablet', label: 'Tablet', icon: 'tablet' },
  { value: 'desktop', label: 'Computer', icon: 'monitor' },
] as const;

/** Light and Dark, not day and night — dark mode is a setting a visitor keeps, and
 *  plenty of people are on it at nine in the morning. */
const MODES = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
] as const;

/**
 * Which device a pane OPENS on.
 *
 * Phone on a phone. The same 1024px the layout collapses at, because below it the
 * canvas is the whole pane: opening on Desktop drew a 1280px frame into 440px of
 * screen, so the author's first sight of their own page was a horizontally
 * scrolling sliver of it.
 *
 * Read once, as an initial value — not reactive, and the VIEWPORT rather than the
 * pane. Rotating a phone or dragging a pane wider must not silently overrule a
 * device the author picked on purpose.
 */
function startingDevice(): CanvasDevice {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 1024 ? 'mobile' : 'desktop';
}

/** Which single column a narrow pane is showing. */
type NarrowView = 'canvas' | 'rail' | 'inspector';

const NARROW_VIEWS: readonly NarrowViewOption<NarrowView>[] = [
  { value: 'rail', label: 'Add & layers', icon: 'plus' },
  { value: 'canvas', label: 'Page', icon: 'page' },
  { value: 'inspector', label: 'Change', icon: 'sliders' },
];

/** Visible on wide panes always; on narrow ones only when it is the chosen view. */
function column(active: boolean, wide: string): string {
  return `${active ? 'flex' : 'hidden'} ${wide}`;
}

export function TreeBuilder({
  toolbarLabel = 'Page editor controls',
  save,
  actions,
  controls,
  attention,
  statusBar,
}: {
  /** Names the bar for a screen reader — several builders are open at once. */
  toolbarLabel?: string;
  /** The app's commit. Never folds, at any width. */
  save?: ReactNode;
  /** The app's other offers — Preview, History, Save as piece, Publish. Fold. */
  actions?: readonly BuilderAction[];
  /** Anything bespoke of the app's, relocated into the popover as-is. */
  controls?: ReactNode;
  /** Marks the folded popover while there is work to publish. */
  attention?: boolean;
  /** The app's own state — saved/unsaved, what is live. Never folds. */
  statusBar?: ReactNode;
}) {
  const store = useDocumentStore<TreeDoc>();
  const paneRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<CanvasDevice>(startingDevice);
  // A theme has two palettes and a page is drawn in one of them. Without this the
  // dark half of a look could only be seen in the pane it was typed into.
  const [mode, setMode] = useState<StudioMode>('light');
  const [rail, setRail] = useState('layers');
  const [view, setView] = useState<NarrowView>('canvas');
  const collapsed = useBuilderFit(paneRef);

  useBuilderShortcuts(paneRef, store);

  return (
    // `tabIndex` so the pane can hold focus and its shortcuts stay its own — a
    // window-level listener would let ctrl+Z here undo an edit in another pane.
    //
    // `@container/builder` is NAMED: the theme rail and several inspector sections
    // open containers of their own, and an unnamed query inside one of those would
    // resolve against the nearest, not against the pane.
    <PointerDragProvider>
      <div
        ref={paneRef}
        tabIndex={-1}
        className="@container/builder flex h-full min-h-0 flex-col outline-none"
      >
        <BuilderToolbar
          label={toolbarLabel}
          collapsed={collapsed}
          views={[
            {
              // Reads as a sentence the chosen option finishes — the tooltip and the
              // accessible name are both "Show this page as phone".
              label: 'Show this page as',
              value: device,
              onValue: (next) => setDevice(next as CanvasDevice),
              options: DEVICES,
            },
            {
              label: 'Show the colors for',
              value: mode,
              onValue: (next) => setMode(next as StudioMode),
              options: MODES,
            },
          ]}
          save={save}
          actions={actions}
          controls={controls}
          attention={attention}
        />

        <div className="flex min-h-0 flex-1">
          <aside
            className={column(
              view === 'rail',
              'border-base-300 w-full shrink-0 flex-col @5xl/builder:flex @5xl/builder:w-64 @5xl/builder:border-r'
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
                {/* Adding is a two-screen act on a phone: tap here, look there. */}
                <Palette onInserted={() => setView('canvas')} />
              </FillTabsPanel>
            </FillTabs>
          </aside>

          <main
            className={column(
              view === 'canvas',
              'min-h-0 min-w-0 flex-1 flex-col @5xl/builder:flex'
            )}
          >
            <Canvas device={device} mode={mode} />
          </main>

          <aside
            className={column(
              view === 'inspector',
              'border-base-300 w-full shrink-0 flex-col @5xl/builder:flex @5xl/builder:w-72 @5xl/builder:border-l'
            )}
          >
            <Inspector device={device} />
          </aside>
        </div>

        <NarrowViewBar views={NARROW_VIEWS} view={view} onView={setView} />

        {statusBar ? (
          <div className="border-base-300 text-base-content flex shrink-0 items-center gap-2 border-t px-3 py-1 text-xs">
            {statusBar}
          </div>
        ) : null}
      </div>
    </PointerDragProvider>
  );
}
