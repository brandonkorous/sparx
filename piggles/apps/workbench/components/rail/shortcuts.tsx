'use client';

// Yours, above the product: the screens this person favourited, and the ones
// they were just in.
//
// Favourites is ALWAYS here, empty or not — a heading that only exists once you
// have used a feature cannot teach you the feature. Empty, it says how to fill
// it. Recent still folds and still starts folded: automatic history does not get
// to push the product off the screen.
//
// COLLAPSED, neither list renders its rows. Five nameless icons above fifteen
// more is where people lose the rail, so each becomes ONE row that browses its
// list into the app panel — the same gesture, and the same destination, as
// clicking an app.

import { Icon } from '@piggles/ui';
import { faChevronDown, faClockRotateLeft, faStar } from '@fortawesome/pro-solid-svg-icons';
import {
  Button,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarItem,
  Text,
} from '@wizeworks/silicaui-react';
import { resolveTitle, type SurfaceDefinition } from '@/lib/surfaces/registry';
import { ListRow, SurfaceRow } from './surface-row';

/** Recents shown on the rail. Even folded away this is a glance, not a log. */
export const RECENT_ON_RAIL = 5;

interface FavouritesProps {
  surfaces: SurfaceDefinition[];
  expanded: boolean;
  /** True while the panel is showing this list. */
  browsing: boolean;
  onBrowseList: () => void;
  onOpen: (definition: SurfaceDefinition) => void;
  onRemove: (definition: SurfaceDefinition) => void;
}

export function Favourites({
  surfaces,
  expanded,
  browsing,
  onBrowseList,
  onOpen,
  onRemove,
}: FavouritesProps) {
  if (!expanded) {
    return (
      <ListRow label="Favourites" glyph={faStar} outline active={browsing} onClick={onBrowseList} />
    );
  }

  return (
    <SidebarGroup>
      {/* The same star that marks a screen on its own tab — one gesture, one
          symbol, wherever it appears. */}
      <SidebarGroupLabel className="flex items-center gap-2">
        <Icon glyph={faStar} outline className="size-4" aria-hidden />
        Favourites
      </SidebarGroupLabel>
      {surfaces.length === 0 ? (
        <Text className="px-2.5 text-sm">Star any screen to keep it here.</Text>
      ) : (
        surfaces.map((definition) => (
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
        ))
      )}
    </SidebarGroup>
  );
}

interface RecentProps {
  surfaces: SurfaceDefinition[];
  expanded: boolean;
  shut: boolean;
  clearing: boolean;
  browsing: boolean;
  onBrowseList: () => void;
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
  browsing,
  onBrowseList,
  onToggle,
  onOpen,
  onClear,
}: RecentProps) {
  if (surfaces.length === 0) return null;

  if (!expanded) {
    return (
      <ListRow label="Recent" glyph={faClockRotateLeft} active={browsing} onClick={onBrowseList} />
    );
  }

  return (
    <SidebarGroup>
      <div className="group/recent relative">
        <SidebarItem
          aria-expanded={!shut}
          // The SAME clock the collapsed rail's Recent row wears, in the same
          // place a row's icon always sits — so the heading is recognisably that
          // row, exactly as the star does for Favourites.
          icon={<Icon glyph={faClockRotateLeft} className="size-5" aria-hidden />}
          // The chevron is a disclosure INDICATOR, not the row's identity: on the
          // left it was standing where every other row keeps its subject, which
          // made Recent the one heading that named itself with a mechanism.
          //
          // No number beside it either. How many recents there are is a list
          // length, and this is the slot the console reserves for what needs doing.
          trailing={
            <Icon
              glyph={faChevronDown}
              className={`size-4 transition-transform ${shut ? '-rotate-90' : ''}`}
              aria-hidden
            />
          }
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
            // Clear of the chevron, which now holds the right end of the row.
            className="absolute top-1/2 right-8 -translate-y-1/2 opacity-0 transition-opacity group-hover/recent:opacity-100 focus-visible:opacity-100"
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
