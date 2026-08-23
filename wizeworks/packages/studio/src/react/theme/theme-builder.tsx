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
//
// The bar across the top is the SAME bar the page and email builders wear
// (builders/builder-toolbar.tsx). It used to be a third copy, and the copies had
// drifted: this one's undo was a circle where theirs were squares, and its
// light/dark switch wore labels where theirs did not.

import { useRef, useState, type ReactNode } from 'react';
import type { ThemeDoc } from '../../documents/types';
import { useDoc, useDocumentStore } from '../context';
import { useUndoShortcuts } from '../builders/shortcuts';
import { BuilderToolbar, type BuilderAction } from '../builders/builder-toolbar';
import { useBuilderFit } from '../builders/use-builder-fit';
import { ThemeBoard } from './board/board';
import { ThemeEditProvider, type ThemeMode } from './edit-context';
import { ThemeStylesheet } from './island';
import { ThemeRail } from './rail';

/** The same two names, the same two glyphs, as every other builder's palette
 *  switch — this pane EDITS the mode it is switched to and the others only LOOK
 *  at it, but it is the same question about the same two bags of color. */
const MODES = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
] as const;

export function ThemeBuilder({
  toolbarLabel = 'Look & feel controls',
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
  /** The app's other offers — Preview, History, Publish. Fold. */
  actions?: readonly BuilderAction[];
  /** Anything bespoke of the app's — the look picker. Relocated as-is. */
  controls?: ReactNode;
  /** Marks the folded popover while there is work to publish. */
  attention?: boolean;
  statusBar?: ReactNode;
}) {
  const doc = useDoc<ThemeDoc>();
  const store = useDocumentStore();
  const [mode, setMode] = useState<ThemeMode>('light');
  // `tabIndex` so the pane can hold focus and its shortcuts stay its own — several
  // documents are open at once, and undo belongs to the one being looked at.
  const paneRef = useRef<HTMLDivElement>(null);
  const collapsed = useBuilderFit(paneRef);
  useUndoShortcuts(paneRef, store);

  return (
    <ThemeEditProvider mode={mode}>
      <div
        ref={paneRef}
        tabIndex={-1}
        className="@container/builder flex h-full min-h-0 flex-col outline-none"
      >
        <ThemeStylesheet theme={doc.theme} />

        <BuilderToolbar
          label={toolbarLabel}
          collapsed={collapsed}
          views={[
            {
              label: 'Edit the colors for',
              value: mode,
              onValue: (next) => setMode(next as ThemeMode),
              options: MODES,
            },
          ]}
          save={save}
          actions={actions}
          controls={controls}
          attention={attention}
        />

        {/* `@container` is on the WRAPPER, never on the element that also carries
            the `@3xl:` classes — an element cannot query itself, and with no other
            container above it the split silently never happens. Unnamed on purpose:
            these query the SPLIT's own box, not the pane the bar measures. */}
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
