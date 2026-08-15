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
  useToast,
} from '@wizeworks/silicaui-react';
import {
  Building2,
  Check,
  ChevronDown,
  CircleQuestionMark,
  Copy,
  CreditCard,
  Globe,
  LayoutGrid,
  Plus,
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
} from '@/lib/api/shell-data';
import { useConfirm } from '@/lib/confirm';
import { deferTick } from '@/lib/defer';
import { useWorkbench } from '@/lib/workbench/context';
import { NotificationCenter } from '@/components/notification-center';
import { useFeedback } from '@/components/feedback/provider';
import { useViewer } from '@/lib/api/shell-data';
import { switchBusiness, useBusinesses } from '@/lib/console/businesses';
import type { Theme } from '@/lib/theme';
import type { WindowMode } from '@/lib/window-mode';

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
  /** Windows or tabs — how open panes are presented. Piggles chrome; sparx has
   *  no equivalent and is not offered one. */
  windowMode: WindowMode;
  onChangeWindowMode: (mode: WindowMode) => void;
  onToggleTheme: () => void;
  onOpenLauncher: () => void;
}

// Quick add. Only surfaces VERIFIED to exist and to accept `{ id: 'new' }` —
// a key that does not resolve opens nothing and reports nothing, so a menu of
// guesses would read as a broken product rather than a missing one.
const QUICK_ADD: { surface: string; label: string }[] = [
  { surface: 'commerce.product.detail', label: 'A product' },
  { surface: 'invoicing.invoice.edit', label: 'An invoice' },
  { surface: 'crm.customer.detail', label: 'A customer' },
];

/** The person's role, in words a business owner uses. The platform's roles are
 *  `owner` / `admin` / `editor` / `viewer`; nobody calls themselves an editor of
 *  their own shop. */
function roleLabel(role: string | undefined): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Runs the place';
    case 'viewer':
      return 'Can look, not touch';
    default:
      return 'Team member';
  }
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
  windowMode,
  onChangeWindowMode,
  onToggleTheme,
  onOpenLauncher,
}: TopbarProps) {
  const { controller } = useWorkbench();
  const signOutForm = useRef<HTMLFormElement>(null);
  const confirm = useConfirm();
  const { data: tenant } = useTenant();
  const { data: sites } = useSites();
  const { data: viewer } = useViewer();
  const feedback = useFeedback();

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

        {/* The BUSINESS switcher — the first of two, and the more consequential.
            "Business", never "tenant" (piggles/CLAUDE.md RULE #3).

            This was plain text, with a comment claiming there was nothing to
            switch to. That was wrong: people genuinely belong to several
            businesses (a bookkeeper, a partner, an owner with two shops), the
            memberships have existed all along, and the platform's `getSession`
            has always resolved the request's tenant from the session's active
            organization — re-checking membership every time. The capability was
            complete on the server and simply unreachable, because the browser
            had no organization client. sparx still has no switcher; this is the
            first surface to offer one.

            Rendered only when there is more than one, so the overwhelming
            majority who have exactly one business see a name, not a control
            implying a choice they do not have. */}
        <BusinessSwitcher siteKey={siteKey} fallbackName={tenant?.name ?? null} />

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
                  <Button color="neutral" variant="ghost" /*size="sm"*/ className="gap-1.5 text-sm">
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

      <NavbarCenter className="min-w-0 flex-1">
        {/* The launcher's front door, and the mockup's centrepiece: "What do you
            want to do?" rather than "Search". The wording is the point — this
            audience does not arrive thinking "I will search for the invoices
            screen", they arrive thinking "I need to bill someone".

            ⌘K works everywhere; this is for the person who has not learned that,
            which for this audience is most people. An `outline` Button rather
            than an Input because it OPENS something — it never holds text, and a
            real field that cannot be typed into is a worse lie than a button
            shaped like one. The variant does the painting; nothing here sets a
            background or a border by hand — and no `color` either, so it wears
            the base ink the theme resolves rather than an assigned grey. */}
        <div className="mx-auto flex w-full max-w-2xl">
          <Button
            // variant="outline"
            className="w-full justify-start gap-2.5 font-normal"
            onClick={onOpenLauncher}
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate text-left">What do you want to do?</span>
            <Kbd /*size="sm"*/>⌘K</Kbd>
          </Button>
        </div>
      </NavbarCenter>

      <NavbarEnd className="gap-1">
        {/* Windows ⇄ tabs. An icon toggle rather than two buttons: it is one
            setting with two states, and the icon shows the state you would be
            switching TO, which is the convention every view-mode control uses.

            It sits with the other whole-window controls (theme, notifications)
            because that is what it is — a preference about the workspace, not
            an action on anything in it. */}
        <Tooltip
          content={
            windowMode === 'tabs'
              ? 'Show each thing in its own window you can move around'
              : 'Tidy everything back into a grid'
          }
        >
          <Button
            variant="ghost"
            /*size="sm"*/
            shape="square"
            aria-label={
              windowMode === 'tabs' ? 'Switch to movable windows' : 'Switch to a tidy grid'
            }
            aria-pressed={windowMode === 'windows'}
            onClick={() => {
              onChangeWindowMode(windowMode === 'tabs' ? 'windows' : 'tabs');
            }}
          >
            {windowMode === 'tabs' ? (
              <Copy className="size-4" aria-hidden />
            ) : (
              <LayoutGrid className="size-4" aria-hidden />
            )}
          </Button>
        </Tooltip>

        {/* Quick add. Every item opens a real create surface — the platform's
            `{ id: 'new' }` convention, where create and edit are the same
            screen. Nothing here is a placeholder. */}
        <DropdownMenu>
          <Tooltip content="Add something">
            <DropdownMenuTrigger>
              <Button color="primary" /*size="sm"*/ shape="square" aria-label="Add something">
                <Plus className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Add something</DropdownMenuLabel>
              {QUICK_ADD.map((item) => (
                <DropdownMenuItem
                  key={item.surface}
                  onClick={() => {
                    controller.open(item.surface, { id: 'new' });
                  }}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <StarButton
          surfaceKey={activeDescriptor?.surface ?? null}
          hasParams={Boolean(
            activeDescriptor?.params && Object.keys(activeDescriptor.params).length > 0
          )}
        />

        <NotificationCenter />

        {/* Help opens the feedback composer, which is a real conversation with a
            real person at the other end. It is deliberately NOT a link to a help
            site, because there isn't one — a `?` pointing at a 404 is worse than
            no `?` at all. */}
        <Tooltip content="Get help or tell us something">
          <Button
            variant="ghost"
            /*size="sm"*/
            shape="square"
            aria-label="Get help or tell us something"
            onClick={() => {
              feedback.openSend();
            }}
          >
            <CircleQuestionMark className="size-4" aria-hidden />
          </Button>
        </Tooltip>

        <Tooltip content={theme === 'light' ? 'Dark' : 'Light'}>
          <Button
            variant="ghost"
            /*size="sm"*/
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
              {/* Name and role beside the avatar, as the mockup has it. Not
                  vanity: this console can act as several BUSINESSES and the role
                  differs per business (owner here, bookkeeper there), so "who am
                  I being right now" is a real question the chrome should answer
                  without a click. Hidden below `md`, where the bar has no room. */}
              <Button
                variant="ghost"
                /*size="sm"*/
                className="gap-2 pr-2 pl-1"
                aria-label={`You — ${userName}`}
              >
                <Avatar size="xs" color="neutral" alt={userName}>
                  {initials(userName)}
                </Avatar>
                <span className="hidden min-w-0 flex-col items-start leading-tight md:flex">
                  <span className="max-w-32 truncate text-sm font-semibold">{userName}</span>
                  <span className="max-w-32 truncate text-xs">{roleLabel(viewer?.role)}</span>
                </span>
                <ChevronDown className="size-3 shrink-0" aria-hidden />
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
 * Which business you are acting as.
 *
 * ── WHY THIS IS A DIFFERENT CONTROL FROM THE SITE SWITCHER ──────────────────
 *
 * A business is a TENANT — its own customers, invoices, staff, books and
 * row-level isolation. A site is one web property inside a business, and a
 * business can own several. Two switchers because they answer two questions:
 * "whose books am I in" and "which of their shopfronts am I editing".
 *
 * Merging them would put "Copperleaf Studio" and "Copperleaf's second shop" in
 * one list, where picking wrongly is either a mistake or a breach depending on
 * which line you hit. They stay apart, and the business sits FIRST because it is
 * the outer scope: the site list only means anything once the business is known.
 *
 * Switching is guarded like every other destructive context change in this app —
 * unsaved work gets a real conversation before the window reloads.
 */
function BusinessSwitcher({
  siteKey,
  fallbackName,
}: {
  siteKey: string;
  fallbackName: string | null;
}) {
  const { controller } = useWorkbench();
  const confirm = useConfirm();
  const toast = useToast();
  const { data: businesses } = useBusinesses();
  const { data: tenant } = useTenant();

  const activeName = tenant?.name ?? fallbackName;

  // One business — the common case by far — is a FACT, not a choice. A dropdown
  // offering a single option is a control that wastes a click to tell you what
  // the label already said.
  if (!businesses || businesses.length <= 1) {
    return (
      <span className="max-w-40 truncate text-sm font-medium" title={activeName ?? undefined}>
        {activeName ?? ' '}
      </span>
    );
  }

  const onSwitch = async (nextId: string) => {
    if (nextId === tenant?.id) return;
    await deferTick();
    const next = businesses.find((business) => business.id === nextId);

    const ok = await confirm({
      title: `Switch to ${next?.name ?? 'another business'}?`,
      description: controller.hasUnsavedWork()
        ? 'Something here has edits that were never saved. Switching business reloads everything and those edits are gone.'
        : 'Everything reloads for that business — its own customers, orders and invoices. What you have open here is saved and waiting when you come back.',
      confirmLabel: 'Switch business',
      cancelLabel: 'Stay here',
      color: controller.hasUnsavedWork() ? 'danger' : 'primary',
    });
    if (!ok) return;

    try {
      await switchBusiness(controller, siteKey, nextId);
    } catch {
      // Reaching here means the server refused — almost always a membership
      // that has been revoked since the list was fetched. Said plainly, because
      // "something went wrong" would leave somebody clicking it again.
      toast.add({
        title: 'Could not switch business',
        description: 'You may no longer have access to it. Nothing here has changed.',
        type: 'error',
      });
    }
  };

  return (
    <DropdownMenu>
      <Tooltip content="Switch business — each one is completely separate">
        <DropdownMenuTrigger>
          <Button color="neutral" variant="ghost" /*size="sm"*/ className="gap-1.5 text-sm">
            <Building2 className="size-3.5" aria-hidden />
            <span className="max-w-44 truncate">{activeName ?? 'Business'}</span>
            <ChevronDown className="size-3" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Your businesses</DropdownMenuLabel>
          {businesses.map((business) => (
            <DropdownMenuItem
              key={business.id}
              onClick={() => {
                void onSwitch(business.id);
              }}
            >
              <span className="flex w-full items-center gap-2">
                <span className="flex-1 truncate">{business.name}</span>
                {business.id === tenant?.id ? <Check className="size-4" aria-hidden /> : null}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Each business keeps its own everything</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
          /*size="sm"*/
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
