'use client';

// An email builder pane — whole and self-contained.
//
// The same arrangement as `TreeBuilder`, over a different vocabulary: layers and
// Insert on the left, the email in the middle, its properties on the right. Not a
// shared shell with a `kind` switch, because almost nothing inside is shared —
// different canvas, different palette, different inspector, different ops — and a
// shell parameterised by all four is a switch statement wearing a component.
//
// Save and Publish are the APP's, so they arrive through `toolbar`.

import { useRef, useState, type ReactNode } from 'react';
import { Button, TabsList, TabsTab } from '@wizeworks/silicaui-react';
import type { EmailDoc } from '../../documents/types';
import { useDocSnapshot, useDocumentStore } from '../context';
import { StudioIcon } from '../icon';
import { FillTabs, FillTabsPanel } from '../fill-tabs';
import type { CanvasDevice } from '../canvas/canvas';
import { EmailCanvas } from '../email/canvas';
import { EmailNavigator } from '../email/navigator';
import { EmailPalette } from '../email/palette';
import { EmailInspector } from '../email/inspector/inspector';
import { useEmailShortcuts } from '../email/shortcuts';

/** Two, not three. An email is one fixed width; a tablet and a computer show the
 *  same thing, so a third button would be a control that does nothing. */
const DEVICES: { value: CanvasDevice; label: string; icon: string }[] = [
  { value: 'mobile', label: 'Phone', icon: 'smartphone' },
  { value: 'desktop', label: 'Computer', icon: 'monitor' },
];

type NarrowView = 'canvas' | 'rail' | 'inspector';

const NARROW_VIEWS: { value: NarrowView; label: string; icon: string }[] = [
  { value: 'rail', label: 'Add & layers', icon: 'plus' },
  { value: 'canvas', label: 'Email', icon: 'page' },
  { value: 'inspector', label: 'Change', icon: 'sliders' },
];

/** Visible on wide screens always; on narrow ones only when it is the chosen view. */
function column(active: boolean, wide: string): string {
  return `${active ? 'flex' : 'hidden'} ${wide}`;
}

export function EmailBuilder({
  toolbar,
  statusBar,
}: {
  /** The app's own actions — Save, Preview, Publish, Send a test. */
  toolbar?: ReactNode;
  /** The app's own state — saved/unsaved, what recipients are getting. */
  statusBar?: ReactNode;
}) {
  const store = useDocumentStore<EmailDoc>();
  const { canUndo, canRedo } = useDocSnapshot();
  const paneRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<CanvasDevice>('desktop');
  const [rail, setRail] = useState('layers');
  const [view, setView] = useState<NarrowView>('canvas');

  useEmailShortcuts(paneRef, store);

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
              <EmailNavigator />
            </FillTabsPanel>
            <FillTabsPanel value="insert">
              <EmailPalette />
            </FillTabsPanel>
          </FillTabs>
        </aside>

        <main className={column(view === 'canvas', 'min-h-0 min-w-0 flex-1 flex-col lg:flex')}>
          <EmailCanvas device={device} />
        </main>

        <aside
          className={column(
            view === 'inspector',
            'border-base-300 w-full shrink-0 flex-col lg:flex lg:w-72 lg:border-l'
          )}
        >
          <EmailInspector />
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
