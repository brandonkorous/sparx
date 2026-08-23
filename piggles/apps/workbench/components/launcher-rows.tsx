'use client';

// The launcher's result list — the grouped rows and the two things it says when
// there are none. Split from launcher.tsx, which owns the dialog, the query and
// the keyboard; this owns only what a row looks like.

import { Icon } from '@piggles/ui';
import type { Entry } from './launcher-match';

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
 */
export function RecordSearchNote({
  searching,
  found,
  query,
}: {
  searching: boolean;
  found: number;
  query: string;
}) {
  if (!query.trim()) return null;
  return (
    <p className="border-base-300 border-t px-3 py-2 text-sm" role="status">
      {searching
        ? 'Looking through your records…'
        : found > 0
          ? `${String(found)} ${found === 1 ? 'record' : 'records'} matched — the rest are screens.`
          : `Nothing in your orders, customers or products matches “${query.trim()}”.`}
    </p>
  );
}

export function LauncherEmpty({ searching, typed }: { searching: boolean; typed: boolean }) {
  return (
    <p className="px-3 py-8 text-center text-sm" role="status">
      {searching
        ? 'Searching…'
        : typed
          ? 'Nothing matches that. Try a different word.'
          : 'Type to search across every module — or pick a screen to open.'}
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
  entry,
  active,
  onHover,
  onSelect,
}: {
  entry: Entry;
  active: boolean;
  onHover: () => void;
  onSelect: (mods: { shiftKey?: boolean; altKey?: boolean }) => void;
}) {
  const glyph = entry.icon;
  return (
    <button
      type="button"
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
