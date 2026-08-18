'use client';

// One screen, as a row in its app's panel.
//
// Three states, and they are three different facts:
//
//   idle      not open. Clicking opens it.
//   open      a pane for this screen exists somewhere. Hollow dot.
//   focused   it is the pane being looked at. `active`, plus a filled dot.
//
// Before this, navigation was the only part of the console that behaved as
// though nothing was open — clicking an already-open screen focused the pane you
// had, with nothing beforehand to say it would.

import { Icon } from '@piggles/ui';
import { Button, SidebarItem, Tooltip } from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { resolveTitle, type OpenTarget, type SurfaceDefinition } from '@/lib/surfaces/registry';
import { surfaceWaiting, WaitingBadge } from '@/components/rail/waiting';
import type { useAttention } from '@/lib/console/home-data';

type Attention = ReturnType<typeof useAttention>;

export interface NavRowProps {
  surface: SurfaceDefinition;
  attention: Attention;
  open: boolean;
  focused: boolean;
  onOpen: (surface: SurfaceDefinition, event: { shiftKey: boolean; altKey: boolean }) => void;
  onCreate: (surface: SurfaceDefinition, event: { shiftKey: boolean; altKey: boolean }) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}

export function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** React key for a row. The surface key alone stopped being unique the moment
 *  one surface could appear once per record type a business invented. */
export function navRowKey(surface: SurfaceDefinition): string {
  const params = surface.defaultParams;
  if (!params) return surface.key;
  return `${surface.key}:${Object.entries(params)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(',')}`;
}

/** Open / focused, as a mark in the row's trailing slot beside its count.
 *  Non-interactive by construction — `trailing` sits inside SidebarItem's own
 *  button, so anything clickable here would be a button inside a button. */
function OpenMark({ open, focused }: { open: boolean; focused: boolean }) {
  if (!open) return null;
  return (
    <span
      aria-hidden
      className={
        focused
          ? 'bg-module size-2 shrink-0 rounded-full'
          : 'border-module size-2 shrink-0 rounded-full border-2'
      }
    />
  );
}

export function NavRow({
  surface,
  attention,
  open,
  focused,
  onOpen,
  onCreate,
  onKeyDown,
}: NavRowProps) {
  const label = resolveTitle(surface, {});
  const hint = focused
    ? `${label} — you are looking at this`
    : open
      ? `${label} — already open, this brings it forward`
      : `${label} — Shift-click to open alongside, Alt-click for a new window`;

  return (
    // `data-guide` on the ROW, not the button: the app guides point at rows, and
    // the row is what carries the `+` beside it.
    <div data-guide={`nav-${surface.key}`} className="group/row relative flex items-center">
      <Tooltip side="right" content={hint}>
        <SidebarItem
          data-nav-item
          className="flex-1"
          // The screen you are looking at is a filled shape, not a hint
          // (DESIGN.md RULE #4). Merely-open rows stay unfilled — two different
          // facts, two different treatments.
          active={focused}
          aria-current={focused ? 'true' : undefined}
          // The app's hue, on every row. It distinguishes nothing WITHIN an app
          // and is the whole distinction BETWEEN them: Sell's column has to be
          // recognisably not Money's at a glance. Hue comes from the <AppScope>
          // around the panel, so nothing here names a color.
          icon={<Icon glyph={surface.icon} className="text-module size-4" aria-hidden />}
          trailing={
            <span className="flex items-center gap-2">
              <WaitingBadge count={surfaceWaiting(surface.key, attention)} />
              <OpenMark open={open} focused={focused} />
            </span>
          }
          onKeyDown={onKeyDown}
          onClick={(event) => {
            onOpen(surface, event);
          }}
        >
          {label}
        </SidebarItem>
      </Tooltip>

      {surface.createSurface ? (
        <Tooltip content={surface.createLabel ?? 'New'}>
          <Button
            color="neutral"
            variant="ghost"
            size="xs"
            shape="square"
            aria-label={surface.createLabel ?? `New ${label}`}
            // Revealed on row hover or its own focus, never display:none — it
            // stays reachable by keyboard.
            className="absolute right-2 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
            onClick={(event) => {
              onCreate(surface, event);
            }}
          >
            <Icon glyph={faPlus} className="size-3.5" aria-hidden />
          </Button>
        </Tooltip>
      ) : null}
    </div>
  );
}
