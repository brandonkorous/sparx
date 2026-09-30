'use client';

// A toolbar's secondary actions, declared as VALUES — the same move as
// pane-toolbar-filters.tsx, for the same reason.
//
// A detail pane's bar is not a list's bar. It has no filters and nothing to
// refresh; what it has is one PRIMARY action (Save) and a couple of things you
// can also do from here (start a deal, start a task). Those were being written
// as icon buttons with `hidden @md:inline` labels, which on a phone leaves two
// bare `+` glyphs side by side — two different actions rendered identically,
// with nothing on screen to tell them apart.
//
// The label is not optional here and not a tooltip. It is the action's name, and
// the bar decides how much of it there is room to show:
//
//   wide      icon + label.
//   narrow    icon only in the bar is NOT an option — that is the bug. They move
//             into the popover and wear their labels there, as rows.
//
// Which also draws the line `primary` was blurring: exactly one action is what
// the surface exists to do. Everything else it OFFERS is an action, and actions
// are allowed to move.

import type { ReactNode } from 'react';
import { Button, Tooltip } from '@wizeworks/silicaui-react';
import { Icon, type IconGlyph } from '@piggles/ui';
import { MENU_ROW } from './toolbar-presentation';
import { ModuleScope, type WorkbenchModule } from './module-scope';

export interface ToolbarAction {
  /** The action's name — accessible name always, visible when there is room. */
  label: string;
  icon: IconGlyph;
  /**
   * Receives the click event, structurally typed.
   *
   * Not `() => void`: every list in the app honours the same modifier contract —
   * Shift opens alongside, Alt opens a new window — via `targetFor(event)`.
   * Narrowing the signature here would silently drop that on 36 surfaces.
   */
  onClick?: (event: { shiftKey: boolean; altKey: boolean }) => void;
  /** Renders as a link opening in a new tab. Use instead of `onClick`. */
  href?: string;
  disabled?: boolean;
  loading?: boolean;
  /**
   * Hover text. Defaults to `label`; set it when the action needs the longer
   * form.
   *
   * Read by all three shapes. It used to be read by `ToolbarPrimaryAction`
   * alone, so "Import a list of old links: hold Alt to open in a new window"
   * was written on a secondary action and shown nowhere - and the Alt modifier
   * it names is not discoverable any other way.
   */
  title?: string;
  /**
   * Wear ANOTHER module's hue.
   *
   * Color follows functionality, not the page: a "write a social post" action
   * on a commerce surface is Social's, and says so. Without this the action
   * would have to stay bespoke JSX in `controls` purely to keep its provider —
   * and bespoke JSX is what looks foreign in the popover.
   */
  module?: WorkbenchModule;
  /**
   * The action's own tone, worn in both shapes.
   *
   * `success` is here for the same reason `danger` is: bringing somebody back
   * off the leavers list is a good outcome and says so, and the only way to
   * give it that color was to hand-write the button in `controls` - where it
   * then lost its name. A tone missing from this list quietly pushes an action
   * out of the one slot that keeps it.
   *
   * Destructive, so it wears `danger` in both shapes.
   *
   * Without it the only way to give Delete / Call it off / Disconnect the color
   * RULE #4 requires was to hand-write the button in `controls`, and a control
   * RELOCATES: in the overflow popover it arrives as a bare red glyph with no
   * row label, because only `actions` are re-authored as labelled rows there. So
   * the missing tone was quietly pushing every destructive action out of the one
   * slot that keeps its name. "Call this run off" was a naked circle-slash above
   * two labelled rows. [[feedback_a_fix_leaves_its_neighbour_behind]]
   */
  tone?: 'danger' | 'success';
}

/** Wraps in a nested provider only when the action belongs to another module. */
function Hue({ module, children }: { module?: WorkbenchModule; children: ReactNode }) {
  if (!module) return <>{children}</>;
  return <ModuleScope module={module}>{children}</ModuleScope>;
}

/** Icon + label in the bar. */
export function ToolbarActionButtons({ actions }: { actions: readonly ToolbarAction[] }) {
  return (
    <>
      {actions.map((action) => (
        // `module`, because an action that belongs to an app wears that app's
        // hue (RULE #4). Ghost so it never competes with the primary beside it.
        <Hue key={action.label} module={action.module}>
          <Tooltip content={action.title ?? action.label}>
            <Button
              size="sm"
              variant="ghost"
              color={action.tone ?? 'module'}
              className="shrink-0"
              aria-label={action.label}
              disabled={action.disabled}
              loading={action.loading}
              {...(action.href
                ? {
                    // Children arrive via `render`, which the rule cannot see.
                    // eslint-disable-next-line jsx-a11y/anchor-has-content -- children arrive via `render`
                    render: <a href={action.href} target="_blank" rel="noreferrer" />,
                  }
                : { onClick: action.onClick })}
            >
              <Icon glyph={action.icon} className="size-4" aria-hidden />
              <span className="hidden @2xl:inline">{action.label}</span>
            </Button>
          </Tooltip>
        </Hue>
      ))}
    </>
  );
}

/** Full-width labelled rows in the overflow popover. */
export function ToolbarActionRows({ actions }: { actions: readonly ToolbarAction[] }) {
  return (
    <>
      {actions.map((action) => (
        <Hue key={action.label} module={action.module}>
          <Button
            size="sm"
            variant="ghost"
            color={action.tone ?? 'module'}
            className={MENU_ROW}
            // Native hover text rather than a Tooltip: this row is already
            // inside a popover, and a floating panel over a floating panel is
            // a second thing to dismiss.
            title={action.title ?? action.label}
            disabled={action.disabled}
            loading={action.loading}
            {...(action.href
              ? {
                  // eslint-disable-next-line jsx-a11y/anchor-has-content -- children arrive via `render`
                  render: <a href={action.href} target="_blank" rel="noreferrer" />,
                }
              : { onClick: action.onClick })}
          >
            <Icon glyph={action.icon} className="size-4" aria-hidden />
            <span>{action.label}</span>
          </Button>
        </Hue>
      ))}
    </>
  );
}

/**
 * The primary action, when it is a simple icon + label.
 *
 * Filled and colored, because it is the thing the surface exists for — never
 * ghost like the secondaries beside it.
 *
 * ── WHY THIS SLOT EXISTS RATHER THAN A CLASS AT THE CALL SITE ──────────────
 *
 * Whether a primary sheds its label on a narrow bar was being decided by a
 * hand-written `hidden @2xl:inline` at each call site, and the call sites did not
 * agree: 46 collapsed, 102 did not, so "+ Add a customer" sat at full width
 * beside a "+" on the next pane.
 *
 * The rule is not "collapse on mobile". It is: THE LABEL MAY HIDE ONLY WHEN THE
 * ICON CAN CARRY IT ALONE. In a pane already titled "Customers", `+` is
 * unambiguous — the title supplies the noun. A floppy disk is not: 29 primaries
 * are a Save, and a Save reduced to a glyph is the one action nobody may be made
 * to hunt for.
 *
 * So the SLOT is the declaration. `primaryAction` means "an icon that speaks for
 * itself" and the bar compacts it; `primary` takes a node and the bar leaves it
 * exactly as written. One decision, not a hundred and forty-eight.
 */
export function ToolbarPrimaryAction({
  action,
  compact,
}: {
  action: ToolbarAction;
  compact: boolean;
}) {
  return (
    <Hue module={action.module}>
      <Button
        size="sm"
        color="module"
        className="shrink-0 whitespace-nowrap"
        aria-label={action.label}
        title={action.title ?? action.label}
        disabled={action.disabled}
        loading={action.loading}
        {...(action.href
          ? {
              // eslint-disable-next-line jsx-a11y/anchor-has-content -- children arrive via `render`
              render: <a href={action.href} target="_blank" rel="noreferrer" />,
            }
          : { onClick: action.onClick })}
      >
        <Icon glyph={action.icon} className="size-4" aria-hidden />
        {compact ? null : <span>{action.label}</span>}
      </Button>
    </Hue>
  );
}
