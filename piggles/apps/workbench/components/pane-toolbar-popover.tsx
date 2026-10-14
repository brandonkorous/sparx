'use client';

// The popover a narrow toolbar folds into. Its trigger is `faBars`, the glyph the
// builders' overflow wears, so "the rest of the controls" is one thing to learn.
// Not `faSliders` (settings elsewhere), not an ellipsis (the dock's window menu).

import { useId, useRef, useState, type RefObject } from 'react';
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { faBars } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

interface PaneToolbarOverflowProps {
  /** The surface's own controls: what you are looking at. */
  controls?: React.ReactNode;
  /** Chrome: what you can do to this pane. Rendered as labeled rows. */
  actions?: React.ReactNode;
  /** How many controls are narrowing what is on screen. The count on the trigger
   *  keeps a folded-away filter visible, so 3 rows of 40 never hide the reason. */
  activeCount?: number;
  /** Names what the popover controls, e.g. "Product list controls". */
  label: string;
}

/** Controls that work INSIDE the menu: pickers, toggles, chips and anything that
 *  opens a menu of its own. Pressing one leaves the panel open (sparx persona
 *  issue 254). */
const KEEPS_MENU_OPEN =
  '[aria-haspopup],[aria-pressed],[aria-expanded],[role=combobox],[role=switch],[role=checkbox],[role=radio],[role=tab],[role=option],[data-keeps-menu-open]';

/** Open state, the carried hue, and the close-on-action rule for one popover. */
function useOverflowMenu() {
  const trigger = useRef<HTMLButtonElement>(null);
  const [module, setModule] = useState<string | null>(null);
  // Controlled so choosing an action closes it: left open, it sat on top of the
  // confirm box the action had just opened (sparx persona issue 254).
  const [open, setOpen] = useState(false);

  // `--color-module` cascades by DOM and the panel is portalled to the body, so
  // the hue is read off the trigger (inside the pane) at the moment of opening.
  const onOpenChange = (next: boolean) => {
    if (next) {
      setModule(trigger.current?.closest('[data-module]')?.getAttribute('data-module') ?? null);
    }
    setOpen(next);
  };

  // Any plain button in the panel is an action, wherever the screen put it.
  // Captured, so the menu closes while its click runs. A nested menu (Views)
  // portals its rows elsewhere, so only a button IN this panel counts.
  const closeOnAction = (event: React.MouseEvent<HTMLElement>) => {
    const button = (event.target as Element).closest('button');
    if (!button || button.disabled || button.matches(KEEPS_MENU_OPEN)) return;
    if (event.currentTarget.contains(button)) setOpen(false);
  };

  return { trigger, module, open, onOpenChange, closeOnAction };
}

export function PaneToolbarOverflow({
  controls,
  actions,
  activeCount = 0,
  label,
}: PaneToolbarOverflowProps) {
  const { trigger, module, open, onOpenChange, closeOnAction } = useOverflowMenu();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <OverflowTrigger label={label} activeCount={activeCount} buttonRef={trigger} />
      <PopoverContent
        {...(module ? { 'data-module': module } : {})}
        side="bottom"
        align="end"
        // `@container` so relocated container queries read this box, not the pane.
        // `p-0` because the zones own their padding. `bg-base-100` because the
        // panel came up transparent, with the table reading through it.
        className="bg-base-100 @container w-[min(20rem,calc(100vw-2rem))] p-0 shadow-lg"
        onClickCapture={closeOnAction}
      >
        <OverflowZones label={label} controls={controls} actions={actions} />
      </PopoverContent>
    </Popover>
  );
}

interface OverflowTriggerProps {
  label: string;
  activeCount: number;
  buttonRef: RefObject<HTMLButtonElement | null>;
}

function OverflowTrigger({ label, activeCount, buttonRef }: OverflowTriggerProps) {
  return (
    <Tooltip
      // Right-most control on the bar, so a centered tooltip would hang off the
      // pane edge. Same reasoning as RefreshButton.
      align="end"
      content={activeCount > 0 ? `${label} (${String(activeCount)} in use)` : label}
    >
      <PopoverTrigger>
        <Button
          ref={buttonRef}
          size="sm"
          shape="circle"
          className="relative shrink-0"
          aria-label={label}
          data-tour="pane-toolbar-overflow"
        >
          <Icon glyph={faBars} className="size-4" aria-hidden />
          {activeCount > 0 ? (
            // `module`, not a semantic tone: an active filter is this app doing
            // its job. The count is in the accessible name, so this is hidden.
            <Badge color="module" size="xs" className="absolute -top-1 -right-1" aria-hidden>
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
    </Tooltip>
  );
}

interface OverflowZonesProps {
  label: string;
  controls?: React.ReactNode;
  actions?: React.ReactNode;
}

/** What you are looking at, a rule, then what you can do: two kinds of thing. */
function OverflowZones({ label, controls, actions }: OverflowZonesProps) {
  const titleId = useId();

  return (
    <>
      {/* A real heading, not `sr-only`: it says what the panel is for. */}
      <h2 id={titleId} className="px-4 pt-3 pb-1 text-sm font-semibold">
        {label}
      </h2>

      {controls ? (
        // A full-width column. The `max-w-none` overrides release caps written for
        // a crowded bar, once here instead of per call site; `[&>.btn]` left-aligns
        // a button passed straight through. [[feedback_silicaui_single_point_of_change]]
        <div
          aria-labelledby={titleId}
          className="flex flex-col items-stretch gap-3 px-4 pt-2 pb-3 [&_.input]:max-w-none [&_.select]:max-w-none [&>.btn]:justify-start [&>div]:w-auto [&>div]:max-w-none"
        >
          {controls}
        </div>
      ) : null}

      {controls && actions ? <div className="bg-base-300 h-px" aria-hidden /> : null}

      {actions ? (
        // A silica `.btn` centers its content. Every child here is a relocated
        // chrome row, so the zone states the row shape once.
        <div className="flex flex-col p-1 [&_.btn]:w-full [&_.btn]:justify-start">{actions}</div>
      ) : null}
    </>
  );
}
