'use client';

// The launcher's result list — the grouped rows and the two things it says when
// there are none. Split from launcher.tsx, which owns the dialog, the query and
// the keyboard; this owns only what a row looks like.

import { Button, useToast } from '@wizeworks/silicaui-react';
import { Icon } from '@piggles/ui';
import type { Entry } from './launcher-match';
import { recordSearchLine, type SearchGaps } from './launcher-search-words';
import { useReindexSearch } from '../lib/api/search';

/**
 * The names the search field uses to point at its own results.
 *
 * A screen reader follows focus, and focus never leaves the text field: arrows
 * move a highlight in a list the field does not own. Without a name to point
 * at, walking that list was completely silent — the `aria-selected` on the row
 * was true and nothing was ever told to read it. So the field is a combobox
 * that CONTROLS this list and names the one row that is current, which is the
 * only way the highlight reaches anybody who cannot see it.
 *
 * A single mounted launcher, so a fixed id is safe; the compact shell returns
 * before the dock renders. [[feedback_absent_behaves_like_fine]]
 */
export const LAUNCHER_LIST_ID = 'launcher-results';

/** One row's id, keyed on its place in the FLAT list — the same number the
 *  keyboard walks, so the field and the render always name the same row. */
export function launcherRowId(index: number): string {
  return `launcher-row-${String(index)}`;
}

/** One run of rows under the app they belong to, carrying each row's index in the
 *  FLAT list so the keyboard and the render agree on what is highlighted. */
export interface EntryGroup {
  group: string;
  rows: { entry: Entry; index: number }[];
}

/** Rows collected into their groups, first-appearance order preserved. */
export function groupEntries(entries: Entry[]): EntryGroup[] {
  const map = new Map<string, { entry: Entry; index: number }[]>();
  entries.forEach((entry, index) => {
    const bucket = map.get(entry.group);
    if (bucket) bucket.push({ entry, index });
    else map.set(entry.group, [{ entry, index }]);
  });
  return [...map.entries()].map(([group, rows]) => ({ group, rows }));
}

/**
 * What the RECORD half of the search has to say, whether or not it found
 * anything.
 *
 * The palette searches two things at once: the screens in this console, and the
 * records in the business. Only one of them ever spoke. Typing "Rob" — a
 * customer with an account, a phone number and an appointment next Friday —
 * returned "Send feedback", "What you told us" and "Things worth fixing",
 * because the letters r-o-b sit inside the word "problem", and said nothing at
 * all about Rob. The list was not empty, so the empty state never showed; the
 * only honest reading was that Piggles has never heard of him.
 *
 * So the record half states its own result, always, the moment anything is
 * typed. "Nothing in your records matches" is an answer. Silence is not.
 *
 * It used to name what it looked through, and got that wrong twice over. The
 * sentence read "Nothing in your orders, customers or products matches", so an
 * owner holding a delivery note and typing PO-000002 was told her ORDERS did not
 * contain it. They do. It was never searched: the universal index carried twenty
 * kinds of record and not one of them came from purchasing. The sentence was
 * then corrected to say so out loud, and purchasing has since been indexed —
 * suppliers, orders to suppliers, deliveries, supplier invoices, returns, stock
 * moves and stock checks — which made the caveat false in the other direction
 * (issue 508).
 *
 * So it no longer lists anything. A list of what was searched is a promise that
 * goes stale every time the index grows, and the useful fact is simply that the
 * record half found nothing and the rows below are screens.
 */
export function RecordSearchNote({
  searching,
  found,
  more,
  onShowMore,
  screens,
  query,
  gaps,
  failed,
  onRetry,
}: {
  searching: boolean;
  found: number;
  /** Records that matched and were not sent. See recordSearchLine. */
  more: number | null;
  /** Fetches the next step of them. Absent when nothing more can come back. */
  onShowMore?: () => void;
  /** How many SCREENS matched, so the sentence may only describe rows that are
   *  actually under it. See recordSearchLine. */
  screens: number;
  query: string;
  /** What `/v1/search/status` says this box cannot reach. Undefined until it
   *  arrives, which is silence rather than "all clear". */
  gaps: SearchGaps | undefined;
  /** The record search did not answer. See recordSearchLine. */
  failed: boolean;
  /** Asks it again. */
  onRetry: () => void;
}) {
  const toast = useToast();
  const reindex = useReindexSearch();
  if (!query.trim()) return null;

  const missing =
    (gaps?.productsMissing ?? 0) + (gaps?.customersMissing ?? 0) + (gaps?.ordersMissing ?? 0);

  return (
    <div className="border-base-300 flex flex-wrap items-center gap-2 border-t px-3 py-2">
      <p className="min-w-0 flex-1 text-sm" role="status">
        {recordSearchLine({
          searching,
          found,
          screens,
          query,
          gaps,
          more,
          canShowMore: onShowMore !== undefined,
          failed,
        })}
      </p>
      {/* The sentence says to try again; this is how, without retyping. */}
      {failed && !searching ? (
        <Button size="sm" color="module" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
      {/* The other half of the sentence's "not shown yet": the box used to stop
          at its first page and count only that, so a name matching more than a
          page said a smaller number and offered nothing. */}
      {onShowMore && (more ?? 0) > 0 && !searching ? (
        <Button size="sm" color="module" onClick={onShowMore}>
          Show more
        </Button>
      ) : null}
      {/* The only remedy, on the screen that is wrong. It existed on the
          products list, which is not where anybody is standing when the box
          says it has never heard of their best seller. */}
      {missing > 0 && !searching ? (
        <Button
          size="sm"
          color="module"
          loading={reindex.isPending}
          onClick={() => {
            reindex.mutate(undefined, {
              onSuccess: () => {
                // No time estimate: the rebuild runs elsewhere and this screen
                // cannot see it start. The sentence above IS the status, and it
                // goes when the records are reachable again.
                toast.add({
                  title: 'Asked for your records to be put back',
                  description:
                    'The line above will change when this box can see them again. If it is the same tomorrow, tell us.',
                  type: 'success',
                });
              },
              onError: () => {
                toast.add({
                  title: 'Could not start that',
                  description: 'Nothing changed. Try again in a moment.',
                  type: 'error',
                });
              },
            });
          }}
        >
          {/* One missing record gets "it". The products list has agreed with its
              own count since issue 318; this button, doing the same job on the
              screen the owner is actually standing on, never did. */}
          {missing === 1 ? 'Put it back' : 'Put them back'}
        </Button>
      ) : null}
    </div>
  );
}

export function LauncherEmpty({
  searching,
  typed,
  failed,
  tooLong,
}: {
  searching: boolean;
  typed: boolean;
  /** The record search did not answer, so only the screens were looked at. */
  failed: boolean;
  /** Past the most the box searches, so the records were not asked. The note
   *  under the list says so; this line speaks only for the screens. */
  tooLong: boolean;
}) {
  return (
    <p className="px-3 py-8 text-center text-sm" role="status">
      {tooLong
        ? 'No screen matches that.'
        : searching
          ? 'Searching…'
          : typed && failed
            ? 'No screen matches that, and your records could not be searched just now.'
            : typed
              ? 'Nothing matches that. Try a different word.'
              : 'Type to search across every app, or pick a screen to open.'}
    </p>
  );
}

export function LauncherGroup({
  group,
  activeIndex,
  onHover,
  onSelect,
}: {
  group: EntryGroup;
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (index: number, mods: { shiftKey?: boolean; altKey?: boolean }) => void;
}) {
  return (
    <div className="mb-1">
      {/* The app this run of rows belongs to. 14px, the caption floor — at
          `text-xs` with tracking it was reading as an uppercase-ish micro-label
          above the thing it introduces, which is the shape RULE #2 bans. It is a
          list heading, so it stays a plain sentence at a readable size. */}
      <div className="px-3 pt-2 pb-1 text-sm font-semibold">{group.group}</div>
      {group.rows.map(({ entry, index }) => (
        <LauncherRow
          key={entry.id}
          id={launcherRowId(index)}
          entry={entry}
          active={index === activeIndex}
          onHover={() => onHover(index)}
          onSelect={(mods) => onSelect(index, mods)}
        />
      ))}
    </div>
  );
}

function LauncherRow({
  id,
  entry,
  active,
  onHover,
  onSelect,
}: {
  /** What the search field names when this row is the current one. */
  id: string;
  entry: Entry;
  active: boolean;
  onHover: () => void;
  onSelect: (mods: { shiftKey?: boolean; altKey?: boolean }) => void;
}) {
  const glyph = entry.icon;
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={active}
      data-active={active}
      // The hue bridge, written straight onto the row rather than through
      // <ModuleScope>: that component renders a <div>, and flow content inside a
      // <button> is invalid markup. The attribute IS the whole mechanism — the
      // `data-module` ⇒ `--color-module` mapping lives in @piggles/brand's
      // theme.css — so nothing is lost.
      //
      // Here the color genuinely distinguishes A from B: one list holds screens
      // from fifteen different apps, and the glyph's hue says which before the
      // label is read.
      data-module={entry.module}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${
        active ? 'bg-base-200' : 'hover:bg-base-200'
      }`}
      onMouseMove={onHover}
      onClick={(event) => onSelect({ shiftKey: event.shiftKey, altKey: event.altKey })}
    >
      {glyph ? <Icon glyph={glyph} className="text-module size-4 shrink-0" aria-hidden /> : null}
      <span className="min-w-0 flex-1 truncate text-base font-medium">{entry.label}</span>
      {entry.subtitle ? (
        <span className="max-w-[45%] shrink truncate text-sm">{entry.subtitle}</span>
      ) : null}
    </button>
  );
}
