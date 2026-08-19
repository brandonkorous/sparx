'use client';

// Where a folded builder bar's controls go.
//
// The same shape the console's list toolbars use, rebuilt here because it cannot be
// imported: that one lives in the app and is drawn with the app's icon set, and
// this package owns no icon dependency. What carries over is the reasoning, which
// was learnt the expensive way there.
//
// ── RELOCATING IS NOT REDESIGNING, AND A GLYPH IS NOT A CONTROL ────────────
//
// In a bar, POSITION does the work — undo is always at the left, Publish always at
// the right — and a tooltip covers the rest. A menu has no position to read and no
// hover on a touch screen, so an unlabelled glyph there is a button with no
// meaning. Everything in this panel therefore wears its name. That is the whole
// reason `actions` are values rather than nodes: a node relocated as-is would
// arrive as the bare glyph it was in the bar.
//
// ── WHAT IS NOT IN HERE ────────────────────────────────────────────────────
//
// The device and palette switches. Those are what the canvas is currently CLAIMING
// TO BE rather than things to do, and an author flips between them constantly while
// judging a design, so they stay in the bar at every width as one button each. This
// panel holds only what the builder OFFERS — preview it, look at its history, save
// a piece of it, publish it.
//
// ── THE TRIGGER ────────────────────────────────────────────────────────────
//
// `menu`, the same glyph a host console puts on its own list-toolbar overflow.
// "The rest of the controls" is one idea and should be one thing to learn, not a
// different glyph per toolbar. An ellipsis was the first choice and lost: a dock
// tab strip is a plausible neighbour above this bar, and one wears an ellipsis for
// its window menu.

import { useId } from 'react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Status,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { StudioIcon } from '../icon';
import type { BuilderAction } from './builder-toolbar';

interface BuilderOverflowProps {
  /** Names the panel, e.g. "Page editor controls". */
  label: string;
  actions?: readonly BuilderAction[];
  /** The app's bespoke nodes, relocated as they are. */
  controls?: React.ReactNode;
  /**
   * Something folded needs to be seen.
   *
   * This is what makes the fold safe. A builder whose Publish is behind a tap, on
   * the device where you can see least, must not also be silent about there being
   * something to publish — that is a screen looking finished while it is not. The
   * status line underneath says so in words; this says so where the control went.
   */
  attention?: boolean;
}

export function BuilderOverflow({ label, actions, controls, attention }: BuilderOverflowProps) {
  const titleId = useId();
  const hasActions = Boolean(actions && actions.length > 0);

  return (
    <Popover>
      <Tooltip
        // Right-most control on the bar, so a centred tooltip hangs off the pane
        // edge.
        align="end"
        content={attention ? `${label} — there is work to publish` : label}
      >
        <PopoverTrigger>
          <Button size="sm" shape="square" className="relative shrink-0" aria-label={label}>
            <StudioIcon name="menu" className="inline-flex size-4" />
            {attention ? (
              // `module`, not a semantic tone: unpublished work is not a warning or
              // an error, it is this app doing its job. A dot rather than a count —
              // there is nothing here to count, only something to notice. The fact
              // is in the accessible name above, so this is decoration to a reader.
              <Status color="module" size="sm" className="absolute -top-0.5 -right-0.5" />
            ) : null}
          </Button>
        </PopoverTrigger>
      </Tooltip>

      <PopoverContent
        side="bottom"
        align="end"
        // `bg-base-100` is not belt-and-braces: a floating surface over a canvas has
        // to state its own ground, or the page being edited reads straight through
        // the controls.
        //
        // `p-0` because the rows are full-bleed, so a hover band reaches the panel
        // edge the way a menu row does.
        className="bg-base-100 w-[min(20rem,calc(100vw-2rem))] p-0 shadow-lg"
      >
        {/* A real heading, not `sr-only`. It is what turns a stack of controls into
            a panel that says what it is for — and it is free, because the bar
            already names itself for the ARIA landmark. */}
        <h2 id={titleId} className="px-4 pt-3 pb-1 text-sm font-semibold">
          {label}
        </h2>

        {/* A silica `.btn` centres its content, which is right in a bar and wrong
            here. Stated once on the zone rather than trusted to each control
            remembering it — including the app's own relocated nodes, which is the
            only way a bespoke control does not arrive looking foreign. */}
        <div
          aria-labelledby={titleId}
          className="flex flex-col p-1 [&_.btn]:w-full [&_.btn]:justify-start"
        >
          {hasActions ? <ActionRows actions={actions ?? []} /> : null}
          {controls}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The app's actions as full-width labelled rows — the whole row is the target. */
function ActionRows({ actions }: { actions: readonly BuilderAction[] }) {
  return (
    <>
      {actions.map((action) => (
        <Button
          key={action.label}
          size="sm"
          // Ghost so the rows read as a menu rather than as a stack of buttons; the
          // loud one keeps its colour, because Publish is still the loud one after
          // it moves.
          variant="ghost"
          {...(action.emphasis === 'loud' ? { color: 'primary' as const } : {})}
          className="gap-2"
          disabled={action.disabled}
          loading={action.loading}
          onClick={action.onClick}
        >
          {action.icon}
          <span>{action.label}</span>
        </Button>
      ))}
    </>
  );
}
