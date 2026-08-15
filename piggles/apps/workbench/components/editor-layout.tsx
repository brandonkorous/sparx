'use client';

// The shape every edit panel wears: a main column that carries the form's
// completion order, and a rail beside it for the running summary and any
// reference panels.
//
// It is a bento, not a stack — but a deliberate one. A form has an order (who is
// this for → what are they charged → anything else), and one section is always
// the point of the screen and wants far more room than the rest. A uniform grid
// of equal tiles would fight both. So the arrangement is fixed by ROLE — a wide
// main column, a narrower rail.
//
// Responsive by CONTAINER, never by viewport, and on Tailwind's NAMED container
// scale (@4xl) rather than a hand-picked pixel width — one scale the whole app
// shares, so breakpoints line up instead of each surface inventing its own. The
// classes are written literally (never `${bp}:x`) so the CSS is actually
// generated. Below the breakpoint the two regions become one column in DOM order
// — main first — so fill order and tab order survive the collapse.

/** Apply to the ONE rail child that should pin while the main column scrolls —
 *  the summary. Sticky only once the layout is actually two-column (@4xl). */
export const EDITOR_RAIL_STICKY = '@4xl:sticky @4xl:top-4';

interface EditorLayoutProps {
  /** The form itself, in completion order. */
  main: React.ReactNode;
  /** The rail: summary first (mark it with EDITOR_RAIL_STICKY), reference after. */
  rail: React.ReactNode;
  /** Full-width content above both regions — alerts, a locked/void notice. */
  banner?: React.ReactNode;
}

export function EditorLayout({ main, rail, banner }: EditorLayoutProps) {
  return (
    <div className="@container">
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        {banner}
        {/* items-start, not stretch: the rail must be free to be shorter than the
            main column, or a sticky child inside it has no slack to move within. */}
        <div className="grid gap-3 @4xl:grid-cols-[minmax(0,1fr)_20rem] @4xl:items-start">
          <div className="flex min-w-0 flex-col gap-3">{main}</div>
          <aside className="flex min-w-0 flex-col gap-3">{rail}</aside>
        </div>
      </div>
    </div>
  );
}
