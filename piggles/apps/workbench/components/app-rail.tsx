'use client';

// The rail — the console's primary navigation, and the one screen element a
// person looks at every single day.
//
// ── FIFTEEN APPS, NOT TWENTY MODULES ────────────────────────────────────────
//
// sparx's rail lists modules, because a module is what sparx sells and therefore
// what a sparx customer has an opinion about. Piggles sells one plan with
// everything in it (piggles/CLAUDE.md RULE #2), so "module" is a word nobody
// here needs — the unit is the thing you are doing. Fifteen apps, in the order a
// business owner already thinks in: your presence, what you sell, the people,
// the money, running the place.
//
// Everything in the rail is derived from the app registry crossed with the
// surface registry (lib/console/nav.ts), so an app cannot exist without being
// reachable and a surface cannot exist without living somewhere.
//
// ── WHAT COMES FIRST ────────────────────────────────────────────────────────
//
// Yours, then the product. What somebody opens on an ordinary day is about five
// screens — and those five used to sit UNDER fifteen app rows they never chose.
// Favourites lead (theirs, and they stay put), then five recents at most, then
// the apps themselves in folding named families (./rail/app-groups.tsx).
//
// The groups only earned headings once favourites and recent moved above them:
// the rail got longer, and folding is what pays for that. A one-app group still
// renders bare, because a heading over a single row is an eyebrow.
//
// Selecting an app BROWSES it — see ./app-panel.tsx. It never changes what is
// open, because in a workbench there is no single "current" place to switch away
// from; a person can have panes from five apps on screen at once.

import { useEffect, useState } from 'react';
import {
  faGrid,
  faGrid2Plus,
  faLeft,
  faRight,
  faTrashCan,
  faXmark,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarItem,
  Tooltip,
  useSidebar,
  useToast,
} from '@wizeworks/silicaui-react';
import { Mark } from '@piggles/brand/react';
import { useConfirm } from '@/lib/confirm';
import { afterMenuClose, deferTick } from '@/lib/defer';
import { useClearRecents, useFavorites, useRecents, useToggleFavorite } from '@/lib/api/shell-data';
import { useBill } from '@/surfaces/finance/bill-data';
import { getSurface, resolveTitle, type SurfaceDefinition } from '@/lib/surfaces/registry';
import {
  surfaceIsVisible,
  useKnownModules,
  useReachableModules,
} from '@/lib/surfaces/use-visible-nav';
import { useWorkbench } from '@/lib/workbench/context';
import {
  clearLayout,
  deleteWorkspace,
  listWorkspaces,
  saveLayout,
  saveWorkspace,
  type NamedWorkspace,
} from '@/lib/workbench/persistence';
import { clearModeLayouts } from '@/lib/mode-layouts';
import { useAttention } from '@/lib/console/home-data';
import { ModuleScope } from '@/components/module-scope';
import { AllAppsDialog } from './all-apps-dialog';
import { AppScope } from './app-scope';
import { AppGroups } from './rail/app-groups';
import type { ConsoleNavApp } from '@/lib/console/nav';

/** Recents shown on the rail. They sit above the apps now, so an unbounded list
 *  would push the product itself off the screen — five is a glance, not a log. */
const RECENT_ON_RAIL = 5;

interface AppRailProps {
  nav: ConsoleNavApp[];
  /** The app currently being browsed, or null when the panel is closed. */
  browsing: string | null;
  /** Storage key for the active site — workspace saves flow through it. */
  siteKey: string;
  /** Labels showing beside the icons. Owned by the shell so it persists. */
  expanded: boolean;
  /** Where the account app lives. The plan card's only link leaves for it. */
  accountOrigin: string;
  onBrowse: (appId: string) => void;
}

export function AppRail({
  nav,
  browsing,
  siteKey,
  expanded,
  accountOrigin,
  onBrowse,
}: AppRailProps) {
  const { controller } = useWorkbench();
  const confirm = useConfirm();
  const toast = useToast();
  // The shell's SidebarProvider, reached the same way SidebarTrigger reaches it.
  // Null outside a provider, which is why the call below is optional.
  const sidebar = useSidebar();

  // ── Favourites + recents ─────────────────────────────────────────────────
  // Both ride the shared /v1/me spine with surface keys as actionIds — the same
  // rows sparx writes, because they are the person's, not the brand's. The rail
  // renders only the ids that name a surface THIS person can reach: unlisted
  // child surfaces and restricted ones resolve to null and drop out.
  const { data: favorites } = useFavorites();
  const { data: recents } = useRecents();
  const toggleFavorite = useToggleFavorite();
  const clearRecents = useClearRecents();
  const reachable = useReachableModules();
  const known = useKnownModules();
  // Shares its queries with Home by query key, so the rail and Home can never
  // show two different numbers for the same thing.
  const attention = useAttention();

  // The SHARED gate, not a second copy of it. This used to test `listed` and the
  // module by hand and never asked `productHidesSurface`, so a surface Piggles
  // does not have could still reach the rail by being favourited or simply opened
  // once — which is how "Modules" came to sit under Recent on a product with no
  // module pricing. One gate, and the launcher and rail cannot drift again.
  const resolveVisible = (actionId: string): SurfaceDefinition | null => {
    const definition = getSurface(actionId);
    if (!definition || definition.listed === false) return null;
    if (!surfaceIsVisible(definition, reachable, known)) return null;
    return definition;
  };

  const favoriteSurfaces = (favorites ?? [])
    .map((favorite) => resolveVisible(favorite.actionId))
    .filter((definition): definition is SurfaceDefinition => definition !== null);

  // A favourite is already pinned above; showing it again under Recent is
  // noise, so recents exclude anything already favourited.
  const favoriteKeys = new Set(favoriteSurfaces.map((definition) => definition.key));
  const recentSurfaces = (recents ?? [])
    .map((recent) => resolveVisible(recent.actionId))
    .filter(
      (definition): definition is SurfaceDefinition =>
        definition !== null && !favoriteKeys.has(definition.key)
    );

  // ── Workspaces ───────────────────────────────────────────────────────────
  // STATE, not a render-time localStorage read — a read during render never
  // updates, so a workspace saved a second ago would not appear until something
  // unrelated re-rendered the rail.
  const [workspaces, setWorkspaces] = useState<NamedWorkspace[]>([]);
  useEffect(() => {
    setWorkspaces(listWorkspaces());
  }, []);
  const [saveOpen, setSaveOpen] = useState(false);
  const [allAppsOpen, setAllAppsOpen] = useState(false);

  // Opening a workspace replaces the live arrangement wholesale, so it goes
  // through the same door as a site switch: confirm unsaved work, write the
  // saved arrangement as the site's current layout, restart the window.
  const restoreWorkspace = async (workspace: NamedWorkspace) => {
    // Let the menu finish closing before any dialog opens — see lib/defer.ts.
    await deferTick();
    if (controller.hasUnsavedWork()) {
      const ok = await confirm({
        title: `Open "${workspace.name}" over unsaved changes?`,
        description:
          'Something here has edits that were never saved. Opening a saved layout reloads the page and those edits are gone.',
        confirmLabel: 'Open it',
        cancelLabel: 'Stay here',
        color: 'danger',
      });
      if (!ok) return;
    }
    saveLayout(siteKey, workspace.grid, workspace.panes);
    window.location.reload();
  };

  const removeWorkspace = async (workspace: NamedWorkspace) => {
    await deferTick();
    const ok = await confirm({
      title: `Delete the "${workspace.name}" layout?`,
      description:
        'Only the saved arrangement is deleted — nothing that was open in it is touched. There is no undo.',
      confirmLabel: 'Delete it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    deleteWorkspace(workspace.id);
    setWorkspaces(listWorkspaces());
  };

  const resetToEmpty = async () => {
    await deferTick();
    const ok = await confirm({
      title: 'Close everything and start empty?',
      description: controller.hasUnsavedWork()
        ? 'Something here has unsaved edits — starting empty discards them. There is no undo.'
        : 'Everything open closes and the page reloads empty. Your saved layouts are not affected.',
      confirmLabel: 'Start empty',
      cancelLabel: 'Keep what I have',
      color: 'danger',
    });
    if (!ok) return;
    clearLayout(siteKey);
    // The other presentation's remembered arrangement goes too. Left behind, the
    // first flick of the windows/tabs toggle would deal an empty workspace an
    // arrangement from before it was emptied — and "start empty" has to mean it
    // in both presentations, not just the one you happened to be looking at.
    clearModeLayouts(siteKey);
    window.location.reload();
  };

  return (
    // The OUTER scope drives the ACTIVE item's accent. `.sidebar-module` declares
    // its accent on the <aside> itself, and a custom property is dereferenced
    // where the DECLARATION lives, not where it is used — so a scope on each item
    // comes too late and every active item resolves to the brand pink. Only one
    // item is ever active and it is always the browsed app, so scoping the aside
    // to `browsing` is both correct and sufficient. The per-item scopes below
    // still drive each ICON's hue, because `text-module` is used on the icon,
    // inside its own scope.
    <AppScope app={browsing ?? 'home'} className="contents">
      <Sidebar
        color="module"
        aria-label="Apps"
        // 3rem collapsed (silica ships 4.5rem — a corridor around a 20px glyph).
        // Set through the component's own documented CSS variable via a Tailwind
        // arbitrary property; never an inline style.
        className="bg-base-100 shrink-0 rounded-lg [--sidebar-w-collapsed:3rem]"
      >
        {/* Padding tracks the width: the stock 0.75rem would leave a 48px rail
            with 24px of usable row. */}
        {/* ── ORDER: yours, then the apps ──────────────────────────────────
            What somebody actually opens every day is five screens, not fifteen
            apps, and those five used to sit BELOW fifteen rows they did not
            choose. Favourites are theirs and stay put; recent is theirs and moves;
            the apps are the whole product, folded into named families beneath
            both. Everything not on this rail is behind All apps in the footer. */}
        <SidebarContent className={expanded ? 'pt-2' : 'px-1.5 pt-2'}>
          {/* Favourites — the person's curated shortcuts. Added from the topbar
              (the focused pane) or removed here; either way this group only
              appears once something is in it, so somebody who has favourited
              nothing never sees an empty heading. */}
          {favoriteSurfaces.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Favourites</SidebarGroupLabel>
              {favoriteSurfaces.map((definition) => (
                <SurfaceRow
                  key={definition.key}
                  definition={definition}
                  expanded={expanded}
                  onOpen={() => {
                    controller.open(definition.key);
                  }}
                  removeLabel={`Remove ${resolveTitle(definition, {})} from favourites`}
                  onRemove={() => {
                    toggleFavorite.mutate({ actionId: definition.key, favorited: true });
                  }}
                />
              ))}
            </SidebarGroup>
          )}

          {/* Recent — automatic history, newest first, FIVE at most. It sits
              above the apps now, and an unbounded list there would push the
              product itself off the screen; five is a glance, not a log. No
              per-row remove: a recent rolls over on its own, so the only
              management it earns is clearing the lot, which rides the label to
              keep it out of the launch path. */}
          {recentSurfaces.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>
                <span className="flex w-full items-center justify-between gap-2">
                  Recent
                  <Button
                    color="danger"
                    variant="ghost"
                    size="xs"
                    disabled={clearRecents.isPending}
                    onClick={() => {
                      clearRecents.mutate();
                    }}
                  >
                    Clear
                  </Button>
                </span>
              </SidebarGroupLabel>
              {recentSurfaces.slice(0, RECENT_ON_RAIL).map((definition) => (
                <SurfaceRow
                  key={definition.key}
                  definition={definition}
                  expanded={expanded}
                  onOpen={() => {
                    controller.open(definition.key);
                  }}
                />
              ))}
            </SidebarGroup>
          )}

          {/* Counts come from the same five server queries Home reads, so the
              rail and Home can never disagree (react-query dedupes them to one
              request each). What they MEAN, and the rollup onto each group
              heading, lives in ./rail/waiting.tsx. */}
          <AppGroups
            nav={nav}
            browsing={browsing}
            expanded={expanded}
            attention={attention}
            onBrowse={onBrowse}
          />
        </SidebarContent>

        <SidebarFooter className={expanded ? undefined : 'px-1.5'}>
          {/* Only when the rail is showing words. Collapsed it is a 48px column
              and a plan card there would be an unreadable smudge; the same
              information is one click away in the account menu. */}
          {expanded ? <PlanCard accountOrigin={accountOrigin} /> : null}

          {/* The door to everything not on the rail.
              It sits in the FOOTER, in the rail itself, and it is permanent —
              not a menu item, not behind a "…". Piggles includes every app on
              every plan, and the only thing that makes that true rather than
              merely stated is whether somebody can SEE the ones they have not
              switched on yet. Bury this and onboarding's question quietly
              becomes a paywall nobody can find the far side of. */}
          <Tooltip content="Everything else Piggles does" side="right" disabled={expanded}>
            <SidebarItem
              icon={<Icon glyph={faGrid2Plus} className="size-5" aria-hidden />}
              aria-label="All apps"
              onClick={() => {
                setAllAppsOpen(true);
              }}
            >
              All apps
            </SidebarItem>
          </Tooltip>

          <DropdownMenu>
            <Tooltip content="Saved layouts" side="right" disabled={expanded}>
              <DropdownMenuTrigger>
                <SidebarItem
                  icon={<Icon glyph={faGrid} className="size-5" aria-hidden />}
                  aria-label="Saved layouts"
                >
                  Layouts
                </SidebarItem>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent side="right" align="end">
              {/* Base UI requires a label to live inside a Group — a bare
                  DropdownMenuLabel throws MenuGroupRootContext at runtime. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>Saved layouts</DropdownMenuLabel>
                {workspaces.length === 0 ? (
                  <DropdownMenuItem disabled>Nothing saved yet</DropdownMenuItem>
                ) : (
                  workspaces.map((workspace) => (
                    <DropdownMenuItem
                      key={workspace.id}
                      onClick={() => {
                        void restoreWorkspace(workspace);
                      }}
                    >
                      <span className="flex w-full items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                        {/* Delete rides inside the row. stopPropagation keeps
                            the row's restore from firing on the same click. */}
                        <Button
                          color="danger"
                          variant="ghost"
                          size="xs"
                          shape="square"
                          aria-label={`Delete the ${workspace.name} layout`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeWorkspace(workspace);
                          }}
                        >
                          <Icon glyph={faTrashCan} className="size-3.5" aria-hidden />
                        </Button>
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  afterMenuClose(() => {
                    setSaveOpen(true);
                  });
                }}
              >
                Save this arrangement…
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void resetToEmpty();
                }}
              >
                Close everything and start empty
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* The collapse control is a SidebarItem, NOT a SidebarTrigger.
              SidebarTrigger is a fixed 2rem square icon button, so a text label
              inside it has nowhere to go and spills out of the rail. SidebarItem
              is the row primitive: it lays out icon + label, hides the label
              itself when collapsed, and carries the same hover/focus treatment as
              every other row — so this reads as part of the rail rather than a
              loose control bolted underneath. It drives the same SidebarProvider
              the shell owns, so the choice persists. */}
          {/* The tooltip is disabled while expanded, so it only ever appears on
              the collapsed rail — where the action is Expand, not Collapse. */}
          <Tooltip content="Expand the app rail" side="right" disabled={expanded}>
            <SidebarItem
              // The arrow points where the rail is going, so the control shows
              // its next state rather than its current one.
              icon={<Icon glyph={expanded ? faLeft : faRight} className="size-5" aria-hidden />}
              aria-label={expanded ? 'Collapse the app rail' : 'Expand the app rail'}
              aria-expanded={expanded}
              onClick={() => {
                sidebar?.toggle();
              }}
            >
              Collapse
            </SidebarItem>
          </Tooltip>
        </SidebarFooter>
      </Sidebar>

      {/* Owned by the rail but OUTSIDE the menu — the menu closes when its item
          is clicked; the dialog opens as its own thing, silicaui end to end
          (window.prompt is not a form). */}
      <AllAppsDialog open={allAppsOpen} onOpenChange={setAllAppsOpen} />

      <SaveLayoutDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        onSave={(name) => {
          saveWorkspace(name, controller.serializeGrid(), {
            ...controller.snapshotDescriptors(),
          });
          setWorkspaces(listWorkspaces());
          toast.add({
            title: 'Layout saved',
            description: `"${name}" is under Layouts whenever you want this arrangement back.`,
            type: 'success',
          });
        }}
      />
    </AppScope>
  );
}

/**
 * A WARNING, when the business is about to stop working. Never a plan card.
 *
 * ── THE LINE THIS DRAWS ─────────────────────────────────────────────────────
 *
 * Account management — the plan, the renewal date, payment methods, invoices,
 * capacity — belongs to getpiggles.com and never appears here
 * (piggles/CLAUDE.md, "The three surfaces"). This used to sit in the rail
 * permanently saying "Business plan · Renews 12 Jul", which is exactly that: a
 * standing account-management fixture in the operating workspace.
 *
 * What survives is the half that is operational rather than commercial. A trial
 * running out or a site already dark is something happening TO the workspace,
 * and the alternative to saying so is a trial that ends by the lights going out
 * with no explanation anywhere in the app. So: nothing at all while the account
 * is healthy, a warning when it is not, and the only action is a door OUT to the
 * app that owns the conversation.
 *
 * A door is not management. A number with a currency symbol in here would be.
 */
function PlanCard({ accountOrigin }: { accountOrigin: string }) {
  const { data: bill } = useBill();

  // Nothing until the answer arrives. A card that says "Business plan" before it
  // knows the plan is a value nobody measured being rendered as one — and the
  // entire job of this card is telling somebody the truth about their account
  // before it stops working.
  if (!bill) return null;

  // ── ONLY THE PHASE VIEW IS READ ─────────────────────────────────────────────
  //
  // `Bill` also carries `planTotalCents`, `planModules` and a card's last four
  // digits. NONE of it is touched here and none of it may be: the console never
  // knows a price (piggles/CLAUDE.md RULE #2), and `bill.billing` is exactly the
  // lifecycle slice — phase, days left, dates — with no money in it.
  //
  // The cleaner long-term shape is a narrow account-service endpoint that
  // returns only this, so the console cannot fetch an amount even by accident.
  // Until that exists, the discipline is the destructure below: read `billing`,
  // never `bill` itself.
  const { phase, daysLeft } = bill.billing;
  const days = daysLeft ?? 0;

  // A healthy account has nothing to say here. Standing billing furniture in the
  // rail is account management, and account management lives at getpiggles.
  if (phase !== 'trialing' && phase !== 'grace' && phase !== 'suspended') return null;

  const tone: 'neutral' | 'warning' | 'danger' =
    phase === 'suspended' ? 'danger' : phase === 'grace' || days <= 3 ? 'warning' : 'neutral';

  const heading = phase === 'trialing' ? 'Free trial' : 'Action needed';

  const detail =
    phase === 'suspended'
      ? 'Your site is offline'
      : phase === 'grace'
        ? `Site stays live ${days} more day${days === 1 ? '' : 's'}`
        : `${days} day${days === 1 ? '' : 's'} left`;

  return (
    <div
      data-plan-tone={tone}
      className="rounded-box border-base-300 bg-base-200 mx-1 mb-2 border p-3"
    >
      <div className="flex items-center gap-2">
        <Mark className="text-primary size-5 shrink-0" />
        <span className="text-base font-bold">{heading}</span>
      </div>
      {/* A real ink, never faded — this is the line that tells somebody their
          business is about to stop working. */}
      <p className="mt-0.5 text-sm">{detail}</p>
      <Button
        color={tone === 'neutral' ? 'neutral' : tone}
        variant={tone === 'neutral' ? 'outline' : 'solid'}
        size="sm"
        block
        className="mt-2.5"
        onClick={() => {
          // Out to the account app, which owns every question this card raises
          // and is the only place allowed to answer them with numbers.
          window.location.href = `${accountOrigin}/account`;
        }}
      >
        {tone === 'neutral' ? 'Set up payment' : 'Keep my business running'}
      </Button>
    </div>
  );
}

/**
 * One favourite or recent row. A launch shortcut, not a navigation position — it
 * never carries an `active` state; clicking opens the surface where any other
 * open would land it.
 *
 * The icon wears the SURFACE's hue rather than its app's, through the platform's
 * own `ModuleScope`. That is deliberate: a shortcut list is mixed, and what a
 * person needs to see at a glance is which family each row belongs to. Under
 * Piggles the module resolves to the same six group hues the rail above uses, so
 * a favourited Orders row is the same burnt orange as the Sell icon — one signal,
 * arrived at by two names.
 *
 * The remove control is an absolute SIBLING of the row, not silica's `trailing`
 * slot: SidebarItem renders as a <button> once it has an onClick, and `trailing`
 * lives INSIDE it — a real control there is a button-in-a-button, which is
 * invalid HTML and a hydration error. Only shown expanded; the collapsed icon
 * rail has no room and is for relaunching, not curating.
 */
function SurfaceRow({
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
  const glyph = definition.icon;
  const title = resolveTitle(definition, {});
  return (
    <ModuleScope module={definition.module}>
      <div className="group relative">
        <Tooltip content={title} side="right" disabled={expanded}>
          <SidebarItem
            icon={<Icon glyph={glyph} className="text-module size-5" aria-hidden />}
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
            // delete buttons. Keyboard reaches it (always in tab order);
            // focus-visible paints it the moment it is focused.
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

function SaveLayoutDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) setName('');
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogTitle>Save this arrangement</DialogTitle>
        <DialogDescription>
          Everything open right now — what is on screen, how it is split, the sizes — saved as a
          layout you can come back to.
        </DialogDescription>
        <Field className="py-2">
          <FieldLabel>Name</FieldLabel>
          <FieldControl
            value={name}
            placeholder="Month end, Packing orders, Tidying the shop…"
            // No autoFocus needed: the dialog's focus trap lands on the first
            // tabbable element, which is this input.
            onChange={(event) => {
              setName(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
          />
          <FieldDescription>Name it after the job it sets you up for</FieldDescription>
        </Field>
        <DialogFooter>
          <DialogClose>
            <Button color="primary" variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button color="primary" size="sm" disabled={!name.trim()} onClick={submit}>
            Save layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
