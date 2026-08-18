'use client';

// Yours, above the product: the screens this person favourited, and the ones
// they were just in.
//
// ── WHY RECENT NOW FOLDS, AND STARTS FOLDED ─────────────────────────────────
//
// Putting both above the apps was right — what somebody opens on an ordinary day
// is about five screens, and those five used to sit under fifteen app rows they
// never chose. But it made the rail longer than the screen: favourites, five
// recents, six group headings, fifteen apps and four footer rows is past thirty,
// and the apps at the bottom fell off a 1080p display.
//
// Favourites are CURATED, so they stay open — a person who put something there
// meant it. Recent is automatic, and automatic history does not get to push the
// product off the screen. It costs one row until asked for, and an explicit open
// is remembered (../../lib/console/rail-groups.ts).

import { Icon } from '@piggles/ui';
import { faChevronDown, faXmark } from '@fortawesome/pro-solid-svg-icons';
import {
  Button,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarItem,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { resolveTitle, type SurfaceDefinition } from '@/lib/surfaces/registry';
import { ModuleScope } from '@/components/module-scope';

/** Recents shown on the rail. Even folded away this is a glance, not a log. */
export const RECENT_ON_RAIL = 5;

/**
 * One favourite or recent row. A launch shortcut, not a navigation position — it
 * never carries an `active` state; clicking opens the surface where any other
 * open would land it.
 *
 * The icon wears the SURFACE's hue rather than its app's, through the platform's
 * own `ModuleScope`: a shortcut list is mixed, and what a person needs at a
 * glance is which family each row belongs to. Under Piggles the module resolves
 * to the same six group hues the rail below uses, so a favourited Orders row is
 * the same burnt orange as the Sell icon — one signal, two names.
 *
 * The remove control is an absolute SIBLING, not silica's `trailing` slot:
 * SidebarItem renders as a <button> once it has an onClick, and `trailing` lives
 * INSIDE it — a real control there is a button-in-a-button. Only shown expanded;
 * the collapsed rail is for relaunching, not curating.
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

interface FavouritesProps {
  surfaces: SurfaceDefinition[];
  expanded: boolean;
  onOpen: (definition: SurfaceDefinition) => void;
  onRemove: (definition: SurfaceDefinition) => void;
}

/** Only rendered once something is in it, so somebody who has favourited nothing
 *  never meets an empty heading. */
export function Favourites({ surfaces, expanded, onOpen, onRemove }: FavouritesProps) {
  if (surfaces.length === 0) return null;
  return (
    <SidebarGroup>
      {expanded ? <SidebarGroupLabel>Favourites</SidebarGroupLabel> : null}
      {surfaces.map((definition) => (
        <SurfaceRow
          key={definition.key}
          definition={definition}
          expanded={expanded}
          onOpen={() => {
            onOpen(definition);
          }}
          removeLabel={`Remove ${resolveTitle(definition, {})} from favourites`}
          onRemove={() => {
            onRemove(definition);
          }}
        />
      ))}
    </SidebarGroup>
  );
}

interface RecentProps {
  surfaces: SurfaceDefinition[];
  expanded: boolean;
  shut: boolean;
  clearing: boolean;
  onToggle: () => void;
  onOpen: (definition: SurfaceDefinition) => void;
  onClear: () => void;
}

/**
 * No per-row remove: a recent rolls over on its own, so the only management it
 * earns is clearing the lot — and that rides the heading, out of the launch path.
 */
export function Recent({
  surfaces,
  expanded,
  shut,
  clearing,
  onToggle,
  onOpen,
  onClear,
}: RecentProps) {
  if (surfaces.length === 0 || !expanded) return null;

  return (
    <SidebarGroup>
      <div className="group/recent relative">
        <SidebarItem
          aria-expanded={!shut}
          icon={
            <Icon
              glyph={faChevronDown}
              className={`size-4 transition-transform ${shut ? '-rotate-90' : ''}`}
              aria-hidden
            />
          }
          // No number. How many recents there are is a list length, and this is
          // the slot the console reserves for what needs doing — the chevron
          // already says there is something behind it.
          onClick={onToggle}
        >
          Recent
        </SidebarItem>
        {/* A SIBLING, never `trailing`: that slot lives inside SidebarItem's own
            <button>. Only offered while the list is open — clearing a history
            you cannot see is a control with no subject. */}
        {shut ? null : (
          <Button
            color="danger"
            variant="ghost"
            size="xs"
            disabled={clearing}
            aria-label="Clear recent"
            className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity group-hover/recent:opacity-100 focus-visible:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
          >
            Clear
          </Button>
        )}
      </div>
      {shut
        ? null
        : surfaces.slice(0, RECENT_ON_RAIL).map((definition) => (
            <SurfaceRow
              key={definition.key}
              definition={definition}
              expanded={expanded}
              onOpen={() => {
                onOpen(definition);
              }}
            />
          ))}
    </SidebarGroup>
  );
}
