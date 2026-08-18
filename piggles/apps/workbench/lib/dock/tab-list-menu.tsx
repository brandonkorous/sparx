'use client';

// "What's open here?" — the searchable jump list for one group's tabs.
//
// This REPLACES dockview's own tabs-overflow dropdown (turned off in dock.tsx
// via `disableTabsOverflowList`), which was unusable for three separate reasons
// and could not be fixed from the outside:
//
//   • It re-rendered the TAB component once per hidden tab — so the list came
//     out as a vertical stack of full-width module-tinted tab chips, complete
//     with the 2px top accent bar and 15rem clamp meant for a horizontal strip.
//     A menu made of tabs reads as a stack of broken tabs, not a list.
//   • `.dv-tabs-overflow-container` has `overflow: auto` and NO height bound,
//     and dockview shifts the popover into view on the next animation frame —
//     which lands BEFORE React has rendered any of the rows into it. So it
//     measured a near-empty box, decided it fitted, and the list then grew to
//     whatever forty rows need and ran off the top and bottom of the screen
//     with nothing to scroll: the tabs at the ends were simply unreachable.
//   • Every row was a live `ContextMenu` trigger with its own close button,
//     inside a container whose click handler bails on `defaultPrevented`.
//
// ── Why a Popover and two real Buttons per row, not a DropdownMenu ─────────
//
// The obvious build is `<DropdownMenu>`: Base UI hands you roving focus and
// typeahead for free. But a menu is the wrong container for BOTH things this
// list needs. A text field inside a menu popup fights the menu's own typeahead
// for every keystroke, and a close button inside a `role="menuitem"` is a
// nested interactive control — invalid, and unreachable by keyboard because Tab
// dismisses the menu instead of moving into the row.
//
// So the container is a Popover, and each row is two ordinary silicaui Buttons
// side by side: the wide one goes to the tab, the square one closes it. Both
// are in the normal tab order, both get their states from `color × variant`,
// and the search field is just a field. What that costs is typeahead, which is
// why ↑/↓/Enter are wired by hand below — and the search field replaces it with
// something better anyway, since it filters rather than merely jumping.
//
// Color is the module's, exactly as on the strip: the icon carries the hue on
// every row, and the tab you are on IS the module hue — a filled soft shape,
// not a checkmark. Scanning forty rows for the commerce one is this control's
// whole job.

import { useEffect, useReducer, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { IDockviewPanel } from 'dockview';
import { faChevronDown, faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchInput,
  Status,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { getSurface } from '../surfaces/registry';
import { useWorkbench } from '../workbench/context';
import { usePaneDirty } from '../workbench/dirty';

interface TabListMenuProps {
  /** Live from dockview's header-actions renderer — it re-renders on add/remove. */
  panels: IDockviewPanel[];
  activePanel: IDockviewPanel | undefined;
}

export function TabListMenu({ panels, activePanel }: TabListMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Titles are the one thing dockview does NOT push into this component: the
  // header-actions renderer updates on panel add/remove and active change, and
  // nothing else. A surface renaming itself once its record loads ("Invoice" ⇒
  // "INV-000004") would leave stale names sitting in the list — and, worse,
  // make them unsearchable under the name on screen. Subscribe to all of them.
  const [, repaint] = useReducer((tick: number) => tick + 1, 0);
  useEffect(() => {
    const subs = panels.map((panel) =>
      panel.api.onDidTitleChange(() => {
        repaint();
      })
    );
    return () => {
      for (const sub of subs) sub.dispose();
    };
  }, [panels]);

  /** The row buttons as they currently stand — read from the DOM (via each
   *  row's `data-tab-row`) rather than from a ref array, because filtering
   *  unmounts rows and a stale index is how arrow-key navigation starts landing
   *  on the wrong thing. */
  const rowButtons = (): HTMLButtonElement[] =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[data-tab-row]') ?? []);

  const focusRow = (index: number): void => {
    const rows = rowButtons();
    if (rows.length === 0) return;
    // Wrapping, so ↓ off the end returns to the top rather than dead-ending.
    rows[((index % rows.length) + rows.length) % rows.length]?.focus();
  };

  // One tab is its own jump list. Deliberately a count of PANELS rather than of
  // tabs scrolled out of view: chrome that appears and disappears as the window
  // is resized can't be relied on, and this is where "show me everything open"
  // now lives.
  if (panels.length < 2) return null;

  // Matched on the title alone — what is on screen is what someone will type.
  // Surface keys and module slugs are our vocabulary, not the operator's.
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? panels.filter((panel) => (panel.title ?? '').toLowerCase().includes(needle))
    : panels;

  const label = `Show all ${String(panels.length)} tabs open here`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // A stale filter waiting behind the button next time reads as "half my
        // tabs vanished". Reopening always starts from everything.
        if (!next) setQuery('');
      }}
    >
      <Tooltip content={label}>
        <PopoverTrigger>
          <Button color="neutral" variant="ghost" size="xs" className="gap-1" aria-label={label}>
            <Icon glyph={faChevronDown} className="size-3.5" aria-hidden />
            <span className="tabular-nums">{panels.length}</span>
          </Button>
        </PopoverTrigger>
      </Tooltip>

      {/* `p-0` because the two halves own their own padding — the search field
          needs to sit flush against its divider. `max-h` on the LIST rather
          than here is what gives it something to scroll inside: bound the
          popup itself and the search field scrolls away with the rows. */}
      <PopoverContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] p-0"
        aria-label="Open tabs"
        initialFocus={searchRef}
      >
        <div className="border-base-300 border-b p-2">
          <SearchInput
            ref={searchRef}
            size="sm"
            value={query}
            onValueChange={setQuery}
            placeholder="Search open tabs…"
            aria-label="Search open tabs"
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                focusRow(0);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                focusRow(-1);
              } else if (event.key === 'Enter') {
                // Type three letters, press Enter, land on the tab — the fast
                // path this control exists for.
                event.preventDefault();
                rowButtons()[0]?.click();
              }
            }}
          />
        </div>

        <ul
          ref={listRef}
          aria-label="Open tabs"
          className="max-h-[min(60vh,24rem)] overflow-y-auto p-1"
        >
          {matches.map((panel) => (
            <TabListRow
              key={panel.id}
              panel={panel}
              active={panel.id === activePanel?.id}
              onActivate={() => {
                // dockview scrolls the strip to the newly-active tab itself, so
                // this is the complete gesture: pick it here, see it there.
                panel.api.setActive();
                setOpen(false);
              }}
              onClosed={() => {
                // The row that had focus has just unmounted. Put focus back in
                // the field rather than letting it fall to <body>, which would
                // dismiss the popover mid-tidy-up.
                searchRef.current?.focus();
              }}
              onNavigate={(event) => {
                if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                event.preventDefault();
                const rows = rowButtons();
                const index = rows.indexOf(event.currentTarget);
                // ↑ from the first row returns to the field — the list and the
                // search read as one column to walk, not two modes.
                if (event.key === 'ArrowUp' && index === 0) {
                  searchRef.current?.focus();
                  return;
                }
                focusRow(index + (event.key === 'ArrowDown' ? 1 : -1));
              }}
            />
          ))}

          {matches.length === 0 ? (
            <li className="px-3 py-6 text-center">Nothing open is called “{query.trim()}”.</li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

interface TabListRowProps {
  panel: IDockviewPanel;
  active: boolean;
  onActivate: () => void;
  onClosed: () => void;
  onNavigate: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function TabListRow({ panel, active, onActivate, onClosed, onNavigate }: TabListRowProps) {
  const { controller } = useWorkbench();
  const descriptor = controller.getDescriptor(panel.id);
  const definition = descriptor ? getSurface(descriptor.surface) : undefined;
  const glyph = definition?.icon;
  const dirty = usePaneDirty(panel.id);
  const title = panel.title ?? 'Panel';

  return (
    // `data-module` is the whole of what <ModuleScope> does (it renders a div
    // carrying this attribute and nothing else — see components/module-scope).
    // Set on the row so both buttons inside resolve the same hue.
    <li data-module={definition?.module ?? 'platform'} className="flex items-center gap-0.5">
      {/* The tab you are on is the module hue itself — color carries "you are
          here" faster than a checkmark can be read. Every other row is chassis. */}
      <Button
        color={active ? 'module' : 'neutral'}
        variant={active ? 'soft' : 'ghost'}
        size="sm"
        className="min-w-0 flex-1 justify-start gap-2"
        onClick={onActivate}
        onKeyDown={onNavigate}
        data-tab-row
      >
        {/* On the active row the variant has already resolved a module ink, so
            the glyph inherits it; elsewhere it carries the hue itself. Same pair
            the tab strip uses — see pane-tab.tsx. */}
        {glyph ? (
          <Icon
            glyph={glyph}
            className={active ? 'size-4 shrink-0' : 'text-module size-4 shrink-0'}
            aria-hidden
          />
        ) : (
          <span className="rounded-selector bg-module size-1.5 shrink-0" aria-hidden />
        )}

        {/* `title` gives the full name back when a long record name is clipped. */}
        <span className="min-w-0 flex-1 truncate text-left" title={title}>
          {title}
        </span>

        {/* Same signal, same color, same wording as the tab's — the list is
            where you look for the unsaved pane you can't currently see. */}
        {dirty ? <Status color="warning" size="sm" label="Unsaved changes" /> : null}
      </Button>

      {/* A sibling, not a nested control: with forty tabs open, tidying up IS
          what this list is for, and asking someone to activate a tab first just
          to close it would make the list a detour. */}
      <Button
        color="neutral"
        variant="ghost"
        size="sm"
        shape="square"
        className="shrink-0"
        aria-label={`Close ${title}`}
        onClick={() => {
          // requestClose, not close: a dirty pane still gets its "close anyway?"
          // conversation, in its own window.
          void controller.requestClose(panel.id).then(onClosed);
        }}
      >
        <Icon glyph={faXmark} className="size-4" aria-hidden />
      </Button>
    </li>
  );
}
