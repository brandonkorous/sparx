'use client';

// The theme builder — one pane, one theme document.
//
// A theme is tenant-wide and reusable across sites, so this pane is not editing
// "this site's colors"; it is editing a thing every site WEARS. Every layout and
// page pane open beside it resolves through the same store, so a change here
// repaints those canvases as it is made — no save, no reload, no socket.
//
// Controls on the left, the whole brand board on the right. The board is the
// point: a theme is not a list of values, it is what those values do to a page,
// and the only way to judge that is to see all of it at once.
//
// LIGHT AND DARK ARE EDITED SEPARATELY, and the switch says which you are on. A
// theme's `dark` map is a delta the author wrote to escape the light value; a
// control that wrote both would silently undo that the first time anyone nudged a
// color.
//
// They are called Light and Dark, not day and night. Dark mode is a setting a
// visitor chooses and keeps — plenty of people are on it at nine in the morning —
// so naming it after a time of day describes the wrong thing.

import { useRef, useState } from 'react';
import { Button, Tooltip } from '@wizeworks/silicaui-react';
import type { ThemeDoc } from '../../documents/types';
import { useDoc, useDocumentStore, useHistoryState } from '../context';
import { useUndoShortcuts } from '../builders/shortcuts';
import { StudioIcon } from '../icon';
import { ThemeBoard } from './board/board';
import { ThemeEditProvider, type ThemeMode } from './edit-context';
import { ThemeStylesheet } from './island';
import { ThemeRail } from './rail';

export function ThemeBuilder({
  toolbar,
  statusBar,
}: {
  toolbar?: React.ReactNode;
  statusBar?: React.ReactNode;
}) {
  const doc = useDoc<ThemeDoc>();
  const store = useDocumentStore();
  const [mode, setMode] = useState<ThemeMode>('light');
  // `tabIndex` so the pane can hold focus and its shortcuts stay its own — several
  // documents are open at once, and undo belongs to the one being looked at.
  const paneRef = useRef<HTMLDivElement>(null);
  useUndoShortcuts(paneRef, store);

  return (
    <ThemeEditProvider mode={mode}>
      <div ref={paneRef} tabIndex={-1} className="flex h-full min-h-0 flex-col outline-none">
        <ThemeStylesheet theme={doc.theme} />

        <div className="border-base-300 flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
          <ModeButton
            icon="sun"
            label="Light"
            selected={mode === 'light'}
            onSelect={() => setMode('light')}
          />
          <ModeButton
            icon="moon"
            label="Dark"
            selected={mode === 'dark'}
            onSelect={() => setMode('dark')}
          />
          <span className="bg-base-300 mx-1 h-6 w-px" aria-hidden />
          <UndoRedo />
          <div className="ml-auto flex items-center gap-2">{toolbar}</div>
        </div>

        {/* `@container` is on the WRAPPER, never on the element that also carries
            the `@3xl:` classes — an element cannot query itself, and with no other
            container above it the split silently never happens. */}
        <div className="@container flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col @3xl:flex-row">
            <div className="border-base-300 flex max-h-96 min-h-0 shrink-0 flex-col border-b @3xl:max-h-none @3xl:w-96 @3xl:border-r @3xl:border-b-0">
              <ThemeRail />
            </div>
            <div className="min-h-0 min-w-0 flex-1">
              <ThemeBoard mode={mode} name={doc.name} />
            </div>
          </div>
        </div>

        {statusBar ? (
          <div className="border-base-300 text-base-content flex shrink-0 items-center gap-2 border-t px-3 py-1 text-sm">
            {statusBar}
          </div>
        ) : null}
      </div>
    </ThemeEditProvider>
  );
}

/**
 * Step back and forward.
 *
 * Visible, not only on the keyboard: the person changing these colors is not
 * expected to know ctrl+Z, and a control that repaints an entire site needs a way
 * back that can be SEEN. One drag is one step — the store folds every frame of it
 * into a single entry.
 */
function UndoRedo() {
  const store = useDocumentStore();
  const { canUndo, canRedo } = useHistoryState();

  return (
    <>
      <Tooltip
        content={store.undoLabel ? `Undo ${store.undoLabel.toLowerCase()}` : 'Nothing to undo'}
      >
        <Button
          size="sm"
          shape="circle"
          disabled={!canUndo}
          aria-label="Undo"
          onClick={() => store.undo()}
        >
          <StudioIcon name="undo" className="text-base" />
        </Button>
      </Tooltip>
      <Tooltip content="Redo">
        <Button
          size="sm"
          shape="circle"
          disabled={!canRedo}
          aria-label="Redo"
          onClick={() => store.redo()}
        >
          <StudioIcon name="redo" className="text-base" />
        </Button>
      </Tooltip>
    </>
  );
}

/** Selection is a filled shape. The one you are not on carries no color at all,
 *  which is what a bare `.btn` is for. */
function ModeButton({
  icon,
  label,
  selected,
  onSelect,
}: {
  icon: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      size="sm"
      aria-pressed={selected}
      {...(selected ? { color: 'primary' as const } : {})}
      onClick={onSelect}
    >
      <StudioIcon name={icon} className="text-base" />
      {label}
    </Button>
  );
}
