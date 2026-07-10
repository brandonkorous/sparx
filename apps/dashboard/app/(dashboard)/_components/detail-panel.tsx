'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  cn,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  ModuleProvider,
  Stack,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sparx/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@wizeworks/silicaui-react';
import { ArrowLeft, Maximize2, MoreHorizontal, PanelRight, Square } from 'lucide-react';
import {
  CREATE_SENTINEL,
  findEntityType,
  fullPageHrefFor,
  isFullBleedCreate,
  isFullBleedDetail,
  isSingleFormDetail,
  isSummaryCreate,
  parseDetailToken,
} from '../_shell/detail-registry';
import { UnsavedGuardProvider, useLeaveGuard } from './unsaved-guard';
import {
  DetailChromeProvider,
  DetailFooterSlotTarget,
  DetailHeaderSlotTarget,
} from './detail-header-slot';

// A target whose content fills the body edge-to-edge (it owns its own padding +
// scroll + pinned toolbar), rather than the default padded single-scroll column.
// Two cases share the treatment: a full-bleed CREATE overlay (the SurfaceFrame
// create forms — `FULL_BLEED_CREATE_TYPES`) and a full-bleed DETAIL view whose
// body is a single edit form on the same SurfaceFrame (`FULL_BLEED_DETAIL_TYPES`).
function isFullBleedTarget(target: DetailTarget): boolean {
  return target.entityId === CREATE_SENTINEL
    ? isFullBleedCreate(target.typeId)
    : isFullBleedDetail(target.typeId);
}

// Client chrome for the dashboard detail view. The detail BODY is rendered
// server-side by the `@detail` parallel slot and passed in as `children`;
// this file only supplies the header (close / open-full-page / switch-mode)
// and decides the render target.
//
// `useDetailTarget()` parses the URL for `?drawer=type:id` / `?modal=type:id`.
// The drawer panel renders inline in the shell's `detail` split; the modal
// panel renders as an overlay. Mode is just a render target — both wrap the
// same server-rendered body.

export interface DetailTarget {
  mode: 'drawer' | 'modal';
  typeId: string;
  entityId: string;
}

// Read the current detail target from the URL. Returns null when no
// detail is open. `modal` overrides `drawer` if both are present.
export function useDetailTarget(): DetailTarget | null {
  const params = useSearchParams();
  const modal = parseDetailToken(params?.get('modal'));
  if (modal) return { mode: 'modal', ...modal };
  const drawer = parseDetailToken(params?.get('drawer'));
  if (drawer) return { mode: 'drawer', ...drawer };
  return null;
}

// Imperative helper to construct a detail URL given (mode, type, id).
export function buildDetailHref(
  pathname: string,
  searchParams: URLSearchParams,
  target: DetailTarget | null
): string {
  const next = new URLSearchParams(searchParams);
  next.delete('drawer');
  next.delete('modal');
  if (target) {
    next.set(target.mode, `${target.typeId}:${target.entityId}`);
  }
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

// ── Inline (drawer) renderer ───────────────────────────────

interface InlineDetailProps {
  target: DetailTarget;
  /** Server-rendered detail body from the `@detail` slot. */
  children: React.ReactNode;
}

export function InlineDetailContent({ target, children }: InlineDetailProps) {
  // The provider wraps BOTH the header chrome and the slot-rendered form so the
  // form can register its dirty-guard and the header's Close/Switch can consult it.
  return (
    <UnsavedGuardProvider>
      <DetailChromeProvider>
        <InlineDetailBody target={target}>{children}</InlineDetailBody>
      </DetailChromeProvider>
    </UnsavedGuardProvider>
  );
}

function InlineDetailBody({ target, children }: InlineDetailProps) {
  const fullBleed = isFullBleedTarget(target);
  return (
    <Stack gap={0} className="h-full">
      <DetailHeader target={target} />
      <div className={fullBleed ? 'min-h-0 flex-1' : 'bg-base-200 flex-1 overflow-y-auto p-6'}>
        {children}
      </div>
    </Stack>
  );
}

// ── Modal renderer ─────────────────────────────────────────

interface ModalDetailProps {
  target: DetailTarget;
  onClose: () => void;
  /** Server-rendered detail body from the `@detail` slot. */
  children: React.ReactNode;
}

export function ModalDetailContent({ target, onClose, children }: ModalDetailProps) {
  // Provider wraps the whole dialog so the body's form can register its guard and
  // both the header chrome AND the backdrop/Esc close path can consult it.
  return (
    <UnsavedGuardProvider>
      <DetailChromeProvider>
        <ModalDetailBody target={target} onClose={onClose}>
          {children}
        </ModalDetailBody>
      </DetailChromeProvider>
    </UnsavedGuardProvider>
  );
}

function ModalDetailBody({ target, onClose, children }: ModalDetailProps) {
  const fullBleed = isFullBleedTarget(target);
  const runGuard = useLeaveGuard();
  // Width by purpose: a single-form edit detail reads best in a tighter dialog so
  // its fields don't stretch; every other record detail — a plain tabbed view or a
  // tabbed view with a full-height summary aside (product) — wants the full canvas.
  // For creates, a wizard with a live summary column gets the wider dialog; a plain
  // create form stays narrow (docs/86 F layout).
  const isCreate = target.entityId === CREATE_SENTINEL;
  const widthClass = !isCreate
    ? isSingleFormDetail(target.typeId)
      ? 'w-[min(960px,94vw)] max-w-[min(960px,94vw)]'
      : 'w-[min(1200px,94vw)] max-w-[min(1200px,94vw)]'
    : isSummaryCreate(target.typeId)
      ? 'w-[min(960px,94vw)] max-w-[min(960px,94vw)]'
      : 'w-[min(720px,94vw)] max-w-[min(720px,94vw)]';
  // A tabbed full-bleed detail (product) runs an inner two-pane whose left column
  // scrolls independently — that needs a DEFINITE body height to scroll against, so
  // this modal takes a fixed 88vh instead of hugging content. Without it the
  // hug-content modal leaves the inner scroll height indefinite, so the form runs
  // UNDER the floored toolbar (the drawer is fine — its panel is already a definite
  // h-full). Single-form full-bleed details (category) and the create wizards manage
  // their own internal scroll + toolbar, so they keep the content hug.
  const fixedHeight = fullBleed && !isCreate && !isSingleFormDetail(target.typeId);
  // Pin the dialog's TOP edge instead of centering it — `top-[6vh]` plus
  // `[transform:translateX(-50%)]`, which REPLACES silica's own hardcoded
  // `transform: translate(-50%,-50%)` (baked into its `.dialog-popup` CSS
  // class, not a Tailwind utility, so a `translate-y-*` utility can't cancel
  // just the Y half — that targets a different CSS property in Tailwind v4
  // and would stack on top of it instead) with ONLY the X half: `left: 50%`
  // (unchanged, still centering horizontally) needs that compensating -50%,
  // but the Y half is dropped since `top` is no longer 50%. A centered
  // overlay that hugs its content grows from the middle when its height changes —
  // switching detail tabs or stepping a wizard makes the header drift up/down.
  // Anchoring at 6vh (where the 88vh-capped tallest content already sits) holds
  // the header fixed and grows the body downward only. Standard for all
  // detail/create overlays; the base `Modal` (confirm/alert dialogs) stays centered.
  // `open` is always true (the dialog is unmounted by navigating, not by state),
  // so backdrop / Esc only fire onOpenChange(false) — we run the dirty-guard and
  // close only when it clears; otherwise the dialog stays put with edits intact.
  const guardedClose = React.useCallback(() => {
    void (async () => {
      if (await runGuard()) onClose();
    })();
  }, [runGuard, onClose]);
  return (
    <Modal open onOpenChange={(open) => !open && guardedClose()}>
      <ModalContent
        hideClose
        className={cn(
          'top-[6vh] max-h-[88vh] [transform:translateX(-50%)] overflow-hidden p-0',
          widthClass
        )}
      >
        <ModalTitle className="sr-only">{describeTarget(target)}</ModalTitle>
        <ModalDescription className="sr-only">
          Detail view for {describeTarget(target)}
        </ModalDescription>
        {/* Hug the content, capped at 88vh (scroll within when taller) — a fixed
            height would leave a tall empty box on short steps. Exception: a tabbed
            full-bleed detail (product) takes a fixed 88vh so its inner two-pane has
            a definite height to scroll against (see `fixedHeight`). Full-bleed
            creates + single-form details manage their own internal scroll. */}
        <Stack gap={0} className={fixedHeight ? 'h-[88vh]' : 'max-h-[88vh]'}>
          <DetailHeader target={target} />
          <div className={fullBleed ? 'min-h-0 flex-1' : 'bg-base-200 flex-1 overflow-y-auto p-6'}>
            {children}
          </div>
        </Stack>
      </ModalContent>
    </Modal>
  );
}

function describeTarget(target: DetailTarget): string {
  const found = findEntityType(target.typeId);
  const label = found?.entityType.label ?? target.typeId;
  return target.entityId === CREATE_SENTINEL ? `New ${label.toLowerCase()}` : label;
}

// ── Shared header chrome ───────────────────────────────────

function DetailHeader({ target }: { target: DetailTarget }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runGuard = useLeaveGuard();
  const found = findEntityType(target.typeId);
  if (!found) return null;
  const { manifest } = found;

  // Close leaves (or remounts) the form, so it runs the dirty-guard first —
  // the active form blocks the leave if it has unsaved edits.
  async function close() {
    if (!(await runGuard())) return;
    const next = new URLSearchParams(searchParams ?? '');
    next.delete('drawer');
    next.delete('modal');
    const qs = next.toString();
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }

  return (
    <ModuleProvider module={manifest.id}>
      {/* "Leaving" is always the far-left control, on every surface — a full
          page gets a real "← {list}" link; this overlay has no list to
          navigate to (it's dismissing a layer, the list is already showing
          behind it), so it's a bare "←" that runs the same guarded close.
          Same icon, same position, same meaning regardless of presentation —
          only the window/switch controls (which view you're in) stay right. */}
      <div
        className={cn(
          'border-base-300 bg-base-100 @container/toolbar flex h-[52px] shrink-0 items-center gap-1 border-b pr-2 pl-2',
          // Reveal the zone-divider only when BOTH the lifecycle and
          // form-actions slots are actually populated (pure CSS — neither
          // slot's fill state is knowable in JS, they're portal targets).
          'has-[[data-slot=lifecycle]:not(:empty)]:has-[[data-slot=formactions]:not(:empty)]:[&>[data-slot=zone-divider]]:flex'
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Close" onClick={() => void close()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close</TooltipContent>
        </Tooltip>

        <span className="text-base-content min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
          {describeTarget(target)}
        </span>

        {/* The detail body teleports its status + lifecycle actions in here so the
            chrome carries them instead of an in-body header that restates the
            editable Title/Handle fields. Empty (zero-width) for surfaces that
            supply none. */}
        <DetailHeaderSlotTarget className="flex items-center gap-2" />

        {/* Toolbar zone divider — Lifecycle (persisted-state actions) vs.
            Form-actions (the open edit's Cancel/Save) are categorically
            different; see the toolbar zone system. */}
        <div
          aria-hidden
          data-slot="zone-divider"
          className="bg-base-300 hidden h-5 w-px shrink-0"
        />

        {/* The detail body's edit tab teleports its Save here too — top-docked
            next to lifecycle actions instead of floored at the panel's bottom
            edge. Zero-width until a form supplies one. Already inside this
            ModuleProvider, so a teleported `color="module"` Save reads the
            module hue (CSS vars cascade by DOM, not the React tree). */}
        <DetailFooterSlotTarget className="flex items-center gap-2" />

        <ViewSwitcher typeId={target.typeId} entityId={target.entityId} current={target.mode} />
      </div>
    </ModuleProvider>
  );
}

// ── View zone — switch presentation ─────────────────────────
// The ONE "which view, and how do I switch" control — shared by the drawer/
// modal chrome (DetailHeader) AND the full-page shell (DetailPageShell), so
// every presentation offers the identical experience instead of two
// independently-maintained implementations (the old Maximize/Switch icon
// pair here, and the old `DetailPresentationSwitch` full-page-only export).
// Collapsed into one "⋯" trigger — switching view is rare enough that it
// doesn't earn always-visible icon buttons (toolbar zone system, View zone),
// and a text-labeled menu beats guessing which bare icon means which mode.
// State-aware: pass the CURRENT presentation and it renders menu items only
// for the other reachable ones, each running the SAME guarded navigation
// (previously only Switch and "open as" were guarded — Maximize wasn't,
// a pre-existing gap this unification also closes).
//
// DropdownMenu here is silica's (Base UI), matching `Modal` below — which is
// ALSO now built on silica's Dialog (see modal.tsx), not raw Radix. The two
// libraries are specifically designed to coordinate portals/focus-trapping
// with each other; a DIFFERENT library's popup nested in one silently fails
// to open (verified — that's the exact bug that broke this menu inside the
// modal presentation until Modal migrated). `Combobox`/`Popover` elsewhere in
// this Modal are still Radix and unaffected by this — Radix popovers
// coordinate fine with each other regardless of which Modal hosts them.
export type DetailViewMode = 'page' | 'drawer' | 'modal';

const VIEW_OPTION: Record<
  DetailViewMode,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  page: { label: 'Open full page', icon: Maximize2 },
  drawer: { label: 'Open as drawer', icon: PanelRight },
  modal: { label: 'Open as modal', icon: Square },
};

export function ViewSwitcher({
  typeId,
  entityId,
  current,
}: {
  typeId: string;
  entityId: string;
  current: DetailViewMode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runGuard = useLeaveGuard();
  const found = findEntityType(typeId);
  if (!found) return null;
  // Null only when the token genuinely can't address a full page (content-entry
  // create with no type-scoped id yet) — that option just doesn't render.
  const fullPageHref = fullPageHrefFor(typeId, entityId);
  const listHref = found.entityType.routePrefix;

  function go(mode: DetailViewMode) {
    void (async () => {
      if (!(await runGuard())) return;
      if (mode === 'page') {
        if (fullPageHref) router.push(fullPageHref);
        return;
      }
      if (current === 'page') {
        router.push(`${listHref}?${mode}=${typeId}:${entityId}`);
        return;
      }
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `${typeId}:${entityId}`);
      router.replace(`${window.location.pathname}?${next.toString()}`);
    })();
  }

  const reachable = (['page', 'drawer', 'modal'] as const).filter(
    (mode) => mode !== current && (mode !== 'page' || fullPageHref)
  );
  if (reachable.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="sm" aria-label="View options">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      {/* This menu can be triggered from inside a Modal (the "modal" view). Base
          UI's floating positioner otherwise renders BEHIND an open dialog —
          see the global stacking-order fix in packages/ui/src/tokens.css. */}
      <DropdownMenuContent align="end">
        {reachable.map((mode) => {
          const { label, icon: Icon } = VIEW_OPTION[mode];
          return (
            <DropdownMenuItem key={mode} onClick={() => go(mode)}>
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
