'use client';

// Favourites and Recent, opened up in the app panel.
//
// The collapsed rail cannot show either list — five nameless icons above fifteen
// more is where people lose their place — so each becomes one row that browses
// its list HERE instead. Same panel, same gesture, same place to look, as an
// app: what a person learns clicking Sell they already know for this.

import { faClockRotateLeft, faStar } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  Button,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarHeaderBrand,
  Text,
} from '@wizeworks/silicaui-react';
import type { SurfaceDefinition } from '@/lib/surfaces/registry';
import { resolveTitle } from '@/lib/surfaces/registry';
import { FAVOURITES_LIST, type ShortcutList } from '@/lib/console/shortcut-lists';
import { RECENT_ON_RAIL } from '../rail/shortcuts';
import { SurfaceRow } from '../rail/surface-row';

interface ShortcutPanelProps {
  list: ShortcutList;
  surfaces: SurfaceDefinition[];
  clearing: boolean;
  onOpen: (definition: SurfaceDefinition) => void;
  onRemove: (definition: SurfaceDefinition) => void;
  onClear: () => void;
}

export function ShortcutPanel({
  list,
  surfaces,
  clearing,
  onOpen,
  onRemove,
  onClear,
}: ShortcutPanelProps) {
  const favourites = list === FAVOURITES_LIST;
  const rows = favourites ? surfaces : surfaces.slice(0, RECENT_ON_RAIL);

  return (
    <Sidebar className="text-neutral-dark-content h-full bg-transparent [--sidebar-w:20rem]">
      <SidebarHeader>
        <SidebarHeaderBrand>
          {/* The same glyph the collapsed rail row wears, for the same reason the
              app panel repeats its app's icon: this header is that row opened. */}
          <Icon
            glyph={favourites ? faStar : faClockRotateLeft}
            outline={favourites}
            className="size-5 shrink-0"
            aria-hidden
          />
          <span className="min-w-0 truncate text-base font-semibold">
            {favourites ? 'Favourites' : 'Recent'}
          </span>
        </SidebarHeaderBrand>
        {/* Clearing a history you cannot see is a control with no subject. */}
        {!favourites && rows.length > 0 ? (
          <Button color="danger" variant="ghost" size="xs" disabled={clearing} onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {rows.length === 0 ? (
            <Text className="px-2.5 text-sm">
              {favourites
                ? 'Star any screen to keep it here.'
                : 'Screens you open will show up here.'}
            </Text>
          ) : (
            rows.map((definition) => (
              <SurfaceRow
                key={definition.key}
                definition={definition}
                expanded
                onOpen={() => {
                  onOpen(definition);
                }}
                removeLabel={
                  favourites ? `Remove ${resolveTitle(definition, {})} from favourites` : undefined
                }
                onRemove={
                  favourites
                    ? () => {
                        onRemove(definition);
                      }
                    : undefined
                }
              />
            ))
          )}
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
