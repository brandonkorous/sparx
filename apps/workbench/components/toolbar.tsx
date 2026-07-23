'use client';

// The top toolbar — identity on the left, person on the right.
//
// The left half answers "where am I operating": the brand mark, the workspace
// (tenant), and the SITE — the one control that changes what every pane means.
// Sites are workspaces here (see lib/api/shell-data.ts switchSite), so the
// switcher is deliberately prominent rather than buried in a settings page.
//
// There is intentionally NO breadcrumb. A breadcrumb narrates a single
// location, and a workbench is in several at once — the pane tabs are the
// orientation. What earns a place up here is only what applies to the whole
// window: search, the focused pane's star, feedback, theme, the person.

import { useSyncExternalStore } from 'react';
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Kbd,
  Navbar,
  NavbarCenter,
  NavbarEnd,
  NavbarStart,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../lib/confirm';
import {
  Check,
  ChevronDown,
  Compass,
  Globe,
  LogOut,
  MessageSquarePlus,
  Moon,
  Search,
  Star,
  Sun,
} from 'lucide-react';
import { signOut } from '@sparx/auth/client';
import { Wordmark } from '@sparx/brand/react';
import {
  switchSite,
  useFavorites,
  useSites,
  useTenant,
  useToggleFavorite,
} from '../lib/api/shell-data';
import { clearToken } from '../lib/api/token';
import { resetClient } from '../lib/api/client';
import { deferTick } from '../lib/defer';
import type { Theme } from '../lib/theme';
import { useWorkbench } from '../lib/workbench/context';
import { FeedbackButton } from './feedback/button';
import { useFeedback } from './feedback/provider';
import { NotificationCenter } from './notification-center';
import { TrialChip } from './billing/trial-chip';
import { launchTour } from '../lib/tour/first-run-tour';

interface ToolbarProps {
  userName: string;
  userEmail: string;
  theme: Theme;
  /** Canonical layout key for the current site — see workbench-shell boot. */
  siteKey: string;
  onToggleTheme: () => void;
  onOpenLauncher: () => void;
}

/** Two-letter fallback for the avatar chip. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return `${first.charAt(0)}${parts[parts.length - 1]?.charAt(0) ?? ''}`.toUpperCase();
}

export function Toolbar({
  userName,
  userEmail,
  theme,
  siteKey,
  onToggleTheme,
  onOpenLauncher,
}: ToolbarProps) {
  const { controller } = useWorkbench();
  const confirm = useConfirm();
  const feedback = useFeedback();
  const { data: tenant } = useTenant();
  const { data: sites } = useSites();

  const activeSite = sites?.find((site) => site.id === siteKey) ?? null;

  // A site switch is a full context change (per-site workspaces), so unsaved
  // work gets a real conversation first — async dialog, never window.confirm
  // (a blocking confirm inside a menu click freezes Base UI's close mid-flight).
  const onSwitchSite = async (nextSiteId: string) => {
    if (nextSiteId === siteKey) return;
    // Let the menu's close commit land before opening a dialog — lib/defer.ts.
    await deferTick();
    if (controller.hasUnsavedWork()) {
      const ok = await confirm({
        title: 'Switch sites with unsaved changes?',
        description:
          'Something here has edits that were never saved. Switching sites reloads the workbench and those edits are gone.',
        confirmLabel: 'Switch anyway',
        cancelLabel: 'Stay here',
        color: 'danger',
      });
      if (!ok) return;
    }
    await switchSite(controller, siteKey, nextSiteId);
  };

  // The focused pane, live — the star and feedback context follow it.
  const activeDescriptor = useSyncExternalStore(
    controller.subscribe,
    () => controller.getActiveDescriptor(),
    () => null
  );

  const onSignOut = () => {
    void signOut().finally(() => {
      clearToken();
      resetClient();
      window.location.href = '/sign-in';
    });
  };

  return (
    <Navbar className="border-base-300 bg-base-100 min-h-0 shrink-0 gap-2 border-b py-1.5 pr-3 pl-0">
      <NavbarStart className="gap-1">
        {/* The mark owns the same 48px column as the collapsed rail below and
            centers on the SAME axis as its icons (x=24). Deliberately pinned to
            the COLLAPSED width: expanding the rail must not slide the brand
            mark sideways — it anchors the window, it isn't part of the rail. */}
        <span className="flex shrink-0 justify-center">
          <Wordmark className="mx-2" size={38} aria-label="sparx" />
        </span>

        {/* Workspace — plain identity, not a control. The tenant is a fact of
            the session; there is nothing to switch it to from here. */}
        <span
          data-tour="workspace"
          className="max-w-40 truncate text-sm font-medium"
          title={tenant?.name}
        >
          {tenant?.name ?? ' '}
        </span>

        {sites && sites.length > 0 ? (
          <span className="inline-flex items-center gap-1" data-tour="site-switcher">
            <span className="text-base-300 select-none" aria-hidden>
              /
            </span>
            <DropdownMenu>
              <Tooltip content="Switch site — each site keeps its own workbench layout">
                <DropdownMenuTrigger>
                  {/* `text-sm` because silica bakes a font-size into every
                      btn-<size> (btn-sm is 12px), which would render the site
                      name a size smaller than the workspace name sitting right
                      beside it. The toolbar speaks in one voice: 14px. */}
                  <Button color="neutral" variant="ghost" size="sm" className="gap-1.5 text-sm">
                    <Globe className="size-3.5" aria-hidden />
                    <span className="max-w-44 truncate">{activeSite?.name ?? 'Site'}</span>
                    <ChevronDown className="size-3" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent align="start">
                {/* Base UI requires a label to live inside a Group — a bare
                    DropdownMenuLabel throws MenuGroupRootContext at runtime. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Sites</DropdownMenuLabel>
                  {sites.map((site) => (
                    <DropdownMenuItem
                      key={site.id}
                      onClick={() => {
                        void onSwitchSite(site.id);
                      }}
                    >
                      <span className="flex w-full items-center gap-2">
                        <span className="flex-1 truncate">{site.name}</span>
                        {site.id === siteKey ? <Check className="size-4" aria-hidden /> : null}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>Each site keeps its own pane layout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        ) : null}
      </NavbarStart>

      <NavbarCenter className="min-w-0">
        {/* The launcher's visible front door. ⌘K works everywhere; this is for
            the person who hasn't learned that yet.

            A ghost Button, with LAYOUT utilities only (width, alignment, gap).
            Never a text-color override: the variant owns its states — outline
            swaps to the fill's content color on hover, and pinning the text
            breaks that contract into same-on-same. */}
        <span data-tour="search" className="inline-flex w-72 max-w-full">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sm"
            onClick={onOpenLauncher}
          >
            <Search className="size-3.5 shrink-0" aria-hidden />
            <span className="flex-1 truncate text-left">Search everything</span>
            <Kbd size="sm">⌘K</Kbd>
          </Button>
        </span>
      </NavbarCenter>

      <NavbarEnd className="gap-1">
        <TrialChip />

        <span data-tour="favorite-star" className="inline-flex">
          <StarButton
            surfaceKey={activeDescriptor?.surface ?? null}
            hasParams={Boolean(
              activeDescriptor?.params && Object.keys(activeDescriptor.params).length > 0
            )}
          />
        </span>

        <NotificationCenter />

        <span data-tour="feedback" className="inline-flex">
          <FeedbackButton />
        </span>

        <Tooltip content={theme === 'light' ? 'Dark theme' : 'Light theme'}>
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            onClick={onToggleTheme}
          >
            {theme === 'light' ? (
              <Moon className="size-4" aria-hidden />
            ) : (
              <Sun className="size-4" aria-hidden />
            )}
          </Button>
        </Tooltip>

        <span data-tour="account-menu" className="inline-flex">
          <DropdownMenu>
            <Tooltip content={userName}>
              <DropdownMenuTrigger>
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  aria-label={`Account — ${userName}`}
                >
                  <Avatar size="xs" color="neutral" alt={userName}>
                    {initials(userName)}
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <span className="flex flex-col">
                    <span className="font-medium">{userName}</span>
                    <span className="text-sm font-normal">{userEmail}</span>
                  </span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  feedback.openList();
                }}
              >
                <MessageSquarePlus className="size-4" aria-hidden />
                Your feedback
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  launchTour();
                }}
              >
                <Compass className="size-4" aria-hidden />
                Take the tour
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut}>
                <LogOut className="size-4" aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </NavbarEnd>
    </Navbar>
  );
}

/**
 * Stars the focused SCREEN. Favorites are surface keys — "Invoices", "New
 * invoice" — shared with the dashboard's favorites spine, so an entity pane
 * (one particular invoice) can't be starred; its surface can.
 */
function StarButton({ surfaceKey, hasParams }: { surfaceKey: string | null; hasParams: boolean }) {
  const { data: favorites } = useFavorites();
  const toggle = useToggleFavorite();

  const starrable = Boolean(surfaceKey) && !hasParams;
  const favorited = Boolean(
    surfaceKey && favorites?.some((favorite) => favorite.actionId === surfaceKey)
  );

  const tooltip = !surfaceKey
    ? 'Focus a pane to star it'
    : hasParams
      ? 'Individual records can’t be starred — star their screen instead'
      : favorited
        ? 'Remove from favorites'
        : 'Add to favorites — shows at the top of search';

  return (
    <Tooltip content={tooltip}>
      {/* The disabled state keeps the tooltip by staying focusable-adjacent:
          silica Buttons drop pointer events when disabled, so wrap in a span. */}
      <span className="inline-flex">
        <Button
          variant="ghost"
          size="sm"
          shape="square"
          disabled={!starrable || toggle.isPending}
          aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={favorited}
          onClick={() => {
            if (surfaceKey) toggle.mutate({ actionId: surfaceKey, favorited });
          }}
        >
          <Star className={favorited ? 'text-warning size-4 fill-current' : 'size-4'} aria-hidden />
        </Button>
      </span>
    </Tooltip>
  );
}
