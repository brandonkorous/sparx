'use client';

// An email builder pane — whole and self-contained.
//
// The same arrangement as `TreeBuilder`, over a different vocabulary: layers and
// Insert on the left, the email in the middle, its properties on the right. Not a
// shared shell with a `kind` switch, because almost nothing inside is shared —
// different canvas, different palette, different inspector, different ops — and a
// shell parameterised by all four is a switch statement wearing a component.
//
// What IS shared is the chrome, and that is now actually shared: the bar and the
// narrow-view switch are the same components the tree builder uses, rather than a
// second copy of them that drifts.
//
// Save and Publish are the APP's, so they arrive through the toolbar's slots.

import { useRef, useState, type ReactNode } from 'react';
import { TabsList, TabsTab } from '@wizeworks/silicaui-react';
import type { EmailDoc } from '../../documents/types';
import { useDocumentStore } from '../context';
import { FillTabs, FillTabsPanel } from '../fill-tabs';
import type { CanvasDevice } from '../canvas/canvas';
import { PointerDragProvider } from '../drag/pointer-drag';
import { EmailCanvas } from '../email/canvas';
import { EmailNavigator } from '../email/navigator';
import { EmailPalette } from '../email/palette';
import { EmailInspector } from '../email/inspector/inspector';
import { useEmailShortcuts } from '../email/shortcuts';
import { BuilderToolbar, type BuilderAction } from './builder-toolbar';
import { NarrowViewBar, type NarrowViewOption } from './narrow-view-bar';
import { useBuilderFit } from './use-builder-fit';

/** Two, not three. An email is one fixed width; a tablet and a computer show the
 *  same thing, so a third button would be a control that does nothing. */
const DEVICES = [
  { value: 'mobile', label: 'Phone', icon: 'smartphone' },
  { value: 'desktop', label: 'Computer', icon: 'monitor' },
] as const;

type NarrowView = 'canvas' | 'rail' | 'inspector';

const NARROW_VIEWS: readonly NarrowViewOption<NarrowView>[] = [
  { value: 'rail', label: 'Add & layers', icon: 'plus' },
  { value: 'canvas', label: 'Email', icon: 'page' },
  { value: 'inspector', label: 'Change', icon: 'sliders' },
];

/** Visible on wide panes always; on narrow ones only when it is the chosen view. */
function column(active: boolean, wide: string): string {
  return `${active ? 'flex' : 'hidden'} ${wide}`;
}

export function EmailBuilder({
  toolbarLabel = 'Email editor controls',
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
  /** The app's other offers — Preview, History, Publish, Send a test. Fold. */
  actions?: readonly BuilderAction[];
  /** Anything bespoke of the app's, relocated into the popover as-is. */
  controls?: ReactNode;
  /** Marks the folded popover while there is work to publish. */
  attention?: boolean;
  /** The app's own state — saved/unsaved, what recipients are getting. */
  statusBar?: ReactNode;
}) {
  const store = useDocumentStore<EmailDoc>();
  const paneRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<CanvasDevice>('desktop');
  const [rail, setRail] = useState('layers');
  const [view, setView] = useState<NarrowView>('canvas');
  const collapsed = useBuilderFit(paneRef);

  useEmailShortcuts(paneRef, store);

  return (
    // `tabIndex` so the pane can hold focus and its shortcuts stay its own — a
    // window-level listener would let ctrl+Z here undo an edit in another pane.
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
              label: 'Show this email as',
              value: device,
              onValue: (next) => setDevice(next as CanvasDevice),
              options: DEVICES,
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
                <EmailNavigator />
              </FillTabsPanel>
              <FillTabsPanel value="insert">
                {/* Adding is a two-screen act on a phone: tap here, look there. */}
                <EmailPalette onInserted={() => setView('canvas')} />
              </FillTabsPanel>
            </FillTabs>
          </aside>

          <main
            className={column(
              view === 'canvas',
              'min-h-0 min-w-0 flex-1 flex-col @5xl/builder:flex'
            )}
          >
            <EmailCanvas device={device} />
          </main>

          <aside
            className={column(
              view === 'inspector',
              'border-base-300 w-full shrink-0 flex-col @5xl/builder:flex @5xl/builder:w-72 @5xl/builder:border-l'
            )}
          >
            <EmailInspector />
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
