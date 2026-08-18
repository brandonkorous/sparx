'use client';

// The two row shapes the shortcut lists are made of: one screen, and one whole
// list standing in for itself while the rail is collapsed.

import { Icon } from '@piggles/ui';
import { faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Button, SidebarGroup, SidebarItem, Tooltip } from '@wizeworks/silicaui-react';
import { resolveTitle, type SurfaceDefinition } from '@/lib/surfaces/registry';
import { ModuleScope } from '@/components/module-scope';

/**
 * One favourite or recent row. A launch shortcut, not a navigation position — it
 * never carries an `active` state; clicking opens the surface where any other
 * open would land it.
 *
 * The icon wears the SURFACE's hue rather than its app's, so a mixed list still
 * says which family each row belongs to at a glance.
 *
 * The remove control is an absolute SIBLING, not silica's `trailing` slot:
 * SidebarItem renders as a <button> once it has an onClick, and `trailing` lives
 * INSIDE it — a real control there is a button-in-a-button.
 */
export function SurfaceRow({
  definition,
  expanded,
  onOpen,
  onRemove,
  removeLabel,
}: {
  definition: SurfaceDefinition;
  expanded: boolean;
  onOpen: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const title = resolveTitle(definition, {});
  return (
    <ModuleScope module={definition.module}>
      <div className="group relative">
        <Tooltip content={title} side="right" disabled={expanded}>
          <SidebarItem
            icon={<Icon glyph={definition.icon} className="text-module size-5" aria-hidden />}
            aria-label={title}
            onClick={onOpen}
          >
            {title}
          </SidebarItem>
        </Tooltip>
        {onRemove && expanded && (
          <Button
            color="primary"
            variant="ghost"
            size="xs"
            shape="square"
            aria-label={removeLabel}
            // Hover/focus-reveal so a curated list does not read as a column of
            // delete buttons. Keyboard reaches it; focus-visible paints it.
            className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <Icon glyph={faXmark} className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>
    </ModuleScope>
  );
}

/** The collapsed stand-in for a whole list: one row that browses it into the
 *  panel. Same shape as an app row, so it reads as one. */
export function ListRow({
  label,
  glyph,
  outline,
  active,
  onClick,
}: {
  label: string;
  glyph: Parameters<typeof Icon>[0]['glyph'];
  outline?: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <SidebarGroup>
      <Tooltip content={label} side="right">
        <SidebarItem
          icon={<Icon glyph={glyph} outline={outline} className="size-5" aria-hidden />}
          aria-label={label}
          active={active}
          aria-current={active ? 'true' : undefined}
          onClick={onClick}
        >
          {label}
        </SidebarItem>
      </Tooltip>
    </SidebarGroup>
  );
}
