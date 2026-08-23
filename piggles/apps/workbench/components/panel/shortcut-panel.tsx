'use client';

// Favourites and Recent, opened up in the app panel.
//
// The rail cannot show either LIST — at 60px they are nameless icons, and
// expanded they are ten rows that push the product off the screen — so each is
// one row there that browses its list HERE instead (../rail/shortcuts.tsx). Same
// panel, same gesture, same place to look, as an app: what a person learns
// clicking Sell they already know for this.
//
// Which makes this the ONLY home either list has, so it behaves like the app
// panel in every way that is about the panel rather than about apps: it pins, it
// dismisses on Escape and after an open when unpinned, and it says what clicking
// a row will do.

import { useEffect } from 'react';
import { faClockRotateLeft, faStar } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  Button,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarHeaderBrand,
  Text,
} from '@wizeworks/silicaui-react';
import type { SurfaceDefinition } from '@/lib/surfaces/registry';
import { resolveTitle } from '@/lib/surfaces/registry';
import { FAVOURITES_LIST, type ShortcutList } from '@/lib/console/shortcut-lists';
import { SurfaceRow } from '../rail/surface-row';
import { PanelPin } from './panel-header';

interface ShortcutPanelProps {
  list: ShortcutList;
  surfaces: SurfaceDefinition[];
  clearing: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  /** Unpinned panels are transient — they close once something is opened. */
  onDismiss: () => void;
  onOpen: (definition: SurfaceDefinition) => void;
  onRemove: (definition: SurfaceDefinition) => void;
  onClear: () => void;
}

export function ShortcutPanel({
  list,
  surfaces,
  clearing,
  pinned,
  onTogglePin,
  onDismiss,
  onOpen,
  onRemove,
  onClear,
}: ShortcutPanelProps) {
  const favourites = list === FAVOURITES_LIST;

  // An unpinned panel is a transient overlay, so Escape must dismiss it — the
  // same expectation any popover sets, and the same effect the app panel runs.
  useEffect(() => {
    if (pinned) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [pinned, onDismiss]);

  const open = (definition: SurfaceDefinition) => {
    onOpen(definition);
    if (!pinned) onDismiss();
  };

  return (
    <Sidebar className="text-chrome-deep-content h-full bg-transparent [--sidebar-w:20rem]">
      <SidebarHeader>
        <SidebarHeaderBrand>
          {/* The same glyph the rail row wears, for the same reason the app panel
              repeats its app's icon: this header is that row opened. */}
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

        {/* Clearing a history you cannot see is a control with no subject. Sits
            before the pin so the destructive control is never the one your hand
            lands on reaching for the panel's own affordance. */}
        {!favourites && surfaces.length > 0 ? (
          <Button color="danger" variant="ghost" size="xs" disabled={clearing} onClick={onClear}>
            Clear
          </Button>
        ) : null}

        <PanelPin pinned={pinned} onTogglePin={onTogglePin} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {surfaces.length === 0 ? (
            <Text className="px-2.5 text-sm">
              {favourites
                ? 'Star any screen to keep it here.'
                : 'Screens you open will show up here.'}
            </Text>
          ) : (
            // The WHOLE list, uncapped: this is the list opened up, and the spine
            // already decides how far back Recent goes (lib/api/shell-data.ts).
            // The rail used to show five and the panel matched it, which meant the
            // opened-up view of a list showed no more of it than the rail did.
            surfaces.map((definition) => (
              <SurfaceRow
                key={definition.key}
                definition={definition}
                expanded
                onOpen={() => {
                  open(definition);
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

      {/* The same sentence the app panel ends on, because the same thing happens:
          a row here opens a pane, it does not navigate away from anything. */}
      <SidebarFooter>
        <Text className="px-2 py-1 text-sm">Opens in a panel you can move anywhere.</Text>
      </SidebarFooter>
    </Sidebar>
  );
}
