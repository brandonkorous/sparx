import type { ReactNode } from 'react';
import { Icon } from '@piggles/ui';
import { appIcon } from '@piggles/config';

// The object a hero figure IS.
//
// Every figure on the site shares one piece of chrome, for the same reason the
// pages share one hero: a lifted rounded panel on the `base-200` band is what
// makes ten different pictures read as ten views of one product rather than as
// ten bits of art. What differs between pages is what is INSIDE it.
//
// `shadow-xl` is Piggles' own — this is a plain div, not a silica Card, so
// nothing else is painting a resting shadow underneath it and there is nothing
// to double up (piggles/DESIGN.md §4). It is a step above the band's own
// `shadow-lg`, which is what puts the figure in front of the hero rather than in
// it.

export function HeroPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-base-100 rounded-section border-base-300 overflow-hidden border shadow-xl ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * A window's title bar — the app's glyph in its group hue, the app's name, and
 * an optional note pushed to the right.
 *
 * Deliberately the same chrome `<TheDay>` draws on the homepage. A visitor who
 * has seen the film should recognise the object on the app page as the same
 * software, and two hand-built title bars that nearly match is how that stops
 * being true.
 */
export function HeroPanelBar({
  app,
  title,
  note,
}: {
  /** App id, for the glyph. */
  app: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="border-base-300 flex items-center gap-3 border-b px-5 py-3.5">
      {/* `ink-module` on the glyph, not `text-module`. On a `bg-soft` tint —
          which is the hue mixed INTO the surface — a pale group hue as the mark
          on top is the same hue against a paler version of itself, and the
          glyph all but disappears. The tint is the fill; the derived ink is what
          goes on it. */}
      <span className="bg-module bg-soft ink-module grid size-7 shrink-0 place-items-center rounded-lg">
        <Icon glyph={appIcon(app)} aria-hidden className="size-4" />
      </span>
      <b className="truncate text-base font-bold">{title}</b>
      {note ? <span className="ml-auto shrink-0 text-sm font-medium">{note}</span> : null}
    </div>
  );
}

/**
 * The rows inside a window. One shape for every figure that lists things, so a
 * price line, a stock level and a booking all sit on the same rhythm.
 */
export function HeroRows({ children }: { children: ReactNode }) {
  return <div className="divide-base-300 grid divide-y">{children}</div>;
}

export function HeroRow({
  label,
  sub,
  right,
}: {
  label: string;
  sub?: string;
  /** A badge, a figure, a state — whatever the row is actually reporting. */
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="truncate text-base font-semibold">{label}</b>
        {sub ? <span className="text-sm">{sub}</span> : null}
      </span>
      {right ? <span className="shrink-0">{right}</span> : null}
    </div>
  );
}
