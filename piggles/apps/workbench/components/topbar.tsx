'use client';

// The top bar — where you are on the left, who you are on the right.
//
// The left half answers "which business, which site": the Piggles lockup, the
// business name, and the SITE — the one control that changes what everything
// else on screen means. A business can own more than one site and they are
// genuinely different businesses to the person walking in the door, so the
// switcher is prominent rather than buried in settings.
//
// There is deliberately NO breadcrumb. A breadcrumb narrates one location, and
// this app is in several at once — the tabs are the orientation. What earns a
// place up here is only what applies to the whole window.

import { useRef, useSyncExternalStore } from 'react';
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
import {
  Check,
  ChevronDown,
  CreditCard,
  Globe,
  LogOut,
  Moon,
  Search,
  Star,
  Sun,
} from 'lucide-react';
import { Logo } from '@piggles/brand/react';
import { PRODUCT } from '@piggles/config';
import {
  switchSite,
  useFavorites,
  useSites,
  useTenant,
  useToggleFavorite,
} from '@workbench/lib/api/shell-data';
import { useConfirm } from '@workbench/lib/confirm';
import { deferTick } from '@workbench/lib/defer';
import { useWorkbench } from '@workbench/lib/workbench/context';
import { NotificationCenter } from '@workbench/components/notification-center';
import type { Theme } from '@/lib/theme';

interface TopbarProps {
  userName: string;
  userEmail: string;
  theme: Theme;
  /** Canonical layout key for the current site — see the shell's boot. */
  siteKey: string;
  /**
   * Where the account app lives, e.g. `https://getpiggles.com`.
   *
   * Threaded down from the server rather than computed here, and that is not
   * fussiness: the origin comes from `PIGGLES_ACCOUNT_ORIGIN`, a server-only
   * variable, and the helper that reads it lives in @piggles/auth-handoff —
   * which imports @sparx/db. Reaching for it from a client component would pull
   * Prisma into the browser bundle to answer a question the server already knew.
   */
  accountOrigin: string;
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

export function Topbar({
  userName,
  userEmail,
  theme,
  siteKey,
  accountOrigin,
  onToggleTheme,
  onOpenLauncher,
}: TopbarProps) {
  const { controller } = useWorkbench();
  const signOutForm = useRef<HTMLFormElement>(null);
  const confirm = useConfirm();
  const { data: tenant } = useTenant();
  const { data: sites } = useSites();

  const activeSite = sites?.find((site) => site.id === siteKey) ?? null;

  // A site switch is a full context change (layouts are per-site), so unsaved
  // work gets a real conversation first — an async dialog, never
  // `window.confirm`, which blocks inside a Base UI menu's close and freezes it
  // mid-flight.
  const onSwitchSite = async (nextSiteId: string) => {
    if (nextSiteId === siteKey) return;
    await deferTick();
    if (controller.hasUnsavedWork()) {
      const ok = await confirm({
        title: 'Switch sites with unsaved changes?',
        description:
          'Something here has edits that were never saved. Switching sites reloads the page and those edits are gone.',
        confirmLabel: 'Switch anyway',
        cancelLabel: 'Stay here',
        color: 'danger',
      });
      if (!ok) return;
    }
    await switchSite(controller, siteKey, nextSiteId);
  };

  // The focused pane, live — the star follows it.
  const activeDescriptor = useSyncExternalStore(
    controller.subscribe,
    () => controller.getActiveDescriptor(),
    () => null
  );

  return (
    <Navbar className="border-base-300 bg-base-100 min-h-0 shrink-0 gap-2 border-b py-1.5 pr-3 pl-0">
      <NavbarStart className="gap-1">
        {/* The delivered lockup — one <svg> on the lockup canvas, never the mark
            and the wordmark set side by side with a guessed gap. Their padded
            boxes overlap in the real artwork, so no positive gap can reproduce
            it. See @piggles/brand's marks.ts. */}
        <span className="flex shrink-0 justify-center">
          <Logo className="mx-3 h-7 w-auto" title={PRODUCT.name} />
        </span>

        {/* The business — plain identity, not a control. Which business you are
            in is a fact of the session; there is nothing to switch it to from
            here. "Business", never "tenant" (piggles/CLAUDE.md RULE #3). */}
        <span className="max-w-40 truncate text-sm font-medium" title={tenant?.name}>
          {tenant?.name ?? ' '}
        </span>

        {sites && sites.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span className="text-base-300 select-none" aria-hidden>
              /
            </span>
            <DropdownMenu>
              <Tooltip content="Switch site — each one keeps its own arrangement">
                <DropdownMenuTrigger>
                  {/* `text-sm` because silica bakes a font-size into every
                      btn-<size> (btn-sm is 12px), which would render the site
                      name a size smaller than the business name sitting right
                      beside it. The bar speaks in one voice: 14px. */}
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
                  <DropdownMenuLabel>Your sites</DropdownMenuLabel>
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
                <DropdownMenuItem disabled>Each site keeps its own arrangement</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        ) : null}
      </NavbarStart>

      <NavbarCenter className="min-w-0">
        {/* The launcher's visible front door. ⌘K works everywhere; this is for
            the person who has not learned that yet — which, for the audience
            this product is for, is most people.

            A ghost Button with LAYOUT utilities only (width, alignment, gap).
            Never a text-colour override: the variant owns its states. */}
        <span className="inline-flex w-72 max-w-full">
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
        <StarButton
          surfaceKey={activeDescriptor?.surface ?? null}
          hasParams={Boolean(
            activeDescriptor?.params && Object.keys(activeDescriptor.params).length > 0
          )}
        />

        <NotificationCenter />

        <Tooltip content={theme === 'light' ? 'Dark' : 'Light'}>
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            aria-label={
              theme === 'light' ? 'Switch to the dark theme' : 'Switch to the light theme'
            }
            onClick={onToggleTheme}
          >
            {theme === 'light' ? (
              <Moon className="size-4" aria-hidden />
            ) : (
              <Sun className="size-4" aria-hidden />
            )}
          </Button>
        </Tooltip>

        <DropdownMenu>
          <Tooltip content={userName}>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="sm" shape="square" aria-label={`You — ${userName}`}>
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
            {/* Off to the account app, because that is where the subscription
                lives. The console never shows a price and never takes a payment
                (piggles/CLAUDE.md RULE #2) — it points at the one place that
                does, so there is never a second answer to "what am I paying". */}
            <DropdownMenuItem
              onClick={() => {
                window.location.href = `${accountOrigin}/account`;
              }}
            >
              <CreditCard className="size-4" aria-hidden />
              Your plan and billing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                // Submits the form below rather than navigating. Signing out
                // changes state on the server — it revokes the session row AND
                // clears this domain's cookie — so it has to be a POST: a GET
                // that does that is one pixel-tracker away from being triggered
                // by any page the person happens to visit.
                //
                // `requestSubmit()` on a form with no submit button is the
                // sanctioned way to do this. A full-page navigation follows, on
                // purpose: everything held in memory should go with it.
                signOutForm.current?.requestSubmit();
              }}
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Outside the menu, because the menu's content is portalled and unmounts
            the moment an item is clicked — a form living inside it would be gone
            before it could be submitted. */}
        <form ref={signOutForm} action="/sign-out" method="post" className="hidden" />
      </NavbarEnd>
    </Navbar>
  );
}

/**
 * Stars the focused SCREEN. Starred items are surface keys — "Invoices", "New
 * invoice" — so one particular invoice cannot be starred; the screen it lives on
 * can.
 */
function StarButton({ surfaceKey, hasParams }: { surfaceKey: string | null; hasParams: boolean }) {
  const { data: favorites } = useFavorites();
  const toggle = useToggleFavorite();

  const starrable = Boolean(surfaceKey) && !hasParams;
  const favorited = Boolean(
    surfaceKey && favorites?.some((favorite) => favorite.actionId === surfaceKey)
  );

  const tooltip = !surfaceKey
    ? 'Open something to star it'
    : hasParams
      ? 'One record can’t be starred — star the screen it lives on'
      : favorited
        ? 'Remove from starred'
        : 'Star this — it goes to the top of the rail and of search';

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
          aria-label={favorited ? 'Remove from starred' : 'Star this'}
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
