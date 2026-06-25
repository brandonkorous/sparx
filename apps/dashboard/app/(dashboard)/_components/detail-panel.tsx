'use client';

import * as React from 'react';
import Link from 'next/link';
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
import { Maximize2, PanelRight, Square, X } from 'lucide-react';
import {
  CREATE_SENTINEL,
  findEntityType,
  fullPageHrefFor,
  isFullBleedCreate,
  isFullBleedDetail,
  isSummaryCreate,
  parseDetailToken,
} from '../_shell/detail-registry';
import { UnsavedGuardProvider, useLeaveGuard } from './unsaved-guard';
import { DetailChromeProvider, DetailHeaderSlotTarget } from './detail-header-slot';

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
      <div className={fullBleed ? 'min-h-0 flex-1' : 'flex-1 overflow-y-auto p-6'}>{children}</div>
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
  // Width by purpose: a tabbed record detail wants the full canvas; a single-form
  // edit detail (full-bleed) or a create wizard with a live summary column wants
  // room for form + summary aside; a plain create form is narrower so its fields
  // don't stretch (docs/86 F layout).
  const isCreate = target.entityId === CREATE_SENTINEL;
  const widthClass = !isCreate
    ? isFullBleedDetail(target.typeId)
      ? 'w-[min(960px,94vw)] max-w-[min(960px,94vw)]'
      : 'w-[min(1200px,94vw)] max-w-[min(1200px,94vw)]'
    : isSummaryCreate(target.typeId)
      ? 'w-[min(960px,94vw)] max-w-[min(960px,94vw)]'
      : 'w-[min(720px,94vw)] max-w-[min(720px,94vw)]';
  // Pin the dialog's TOP edge (`top-[6vh] translate-y-0` overrides the base
  // `top-1/2 -translate-y-1/2` via twMerge) instead of centering it. A centered
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
        className={cn('top-[6vh] max-h-[88vh] translate-y-0 overflow-hidden p-0', widthClass)}
      >
        <ModalTitle className="sr-only">{describeTarget(target)}</ModalTitle>
        <ModalDescription className="sr-only">
          Detail view for {describeTarget(target)}
        </ModalDescription>
        {/* Hug the content, capped at 88vh (scroll within when taller) — a fixed
            height would leave a tall empty box on short steps. Full-bleed create
            (the product wizard) drops the padded single-scroll column so its
            two-pane frame fills the body edge-to-edge and manages its own scroll. */}
        <Stack gap={0} className="max-h-[88vh]">
          <DetailHeader target={target} />
          <div className={fullBleed ? 'min-h-0 flex-1' : 'flex-1 overflow-y-auto p-6'}>
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
  // Null only when the token genuinely can't address a full page. content-entry
  // encodes <typeKey>:<id> so this resolves to /cms/types/<typeKey>/<id> like
  // any other entity — the maximize button shows for it too.
  const fullPageHref = fullPageHrefFor(target.typeId, target.entityId);

  // Close + switch both leave (or remount) the form, so they run the dirty-guard
  // first — the active form blocks the leave if it has unsaved edits.
  async function close() {
    if (!(await runGuard())) return;
    const next = new URLSearchParams(searchParams ?? '');
    next.delete('drawer');
    next.delete('modal');
    const qs = next.toString();
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }

  async function switchMode() {
    if (!(await runGuard())) return;
    const next = new URLSearchParams(searchParams ?? '');
    const nextMode: 'drawer' | 'modal' = target.mode === 'drawer' ? 'modal' : 'drawer';
    next.delete('drawer');
    next.delete('modal');
    next.set(nextMode, `${target.typeId}:${target.entityId}`);
    router.replace(`${window.location.pathname}?${next.toString()}`);
  }

  const SwitchIcon = target.mode === 'drawer' ? Square : PanelRight;
  const switchLabel = target.mode === 'drawer' ? 'Switch to modal' : 'Switch to drawer';

  return (
    <ModuleProvider module={manifest.id}>
      {/* Title on the left, window controls on the right with Close last (the
          corner), matching the wizard F layout (docs/86). */}
      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] pr-2 pl-5">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
          {describeTarget(target)}
        </span>

        {/* The detail body teleports its status + lifecycle actions in here so the
            chrome carries them instead of an in-body header that restates the
            editable Title/Handle fields. Empty (zero-width) for surfaces that
            supply none. */}
        <DetailHeaderSlotTarget className="flex items-center gap-2" />

        {fullPageHref && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Open in full page" asChild>
                <Link href={fullPageHref}>
                  <Maximize2 className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in full page</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={switchLabel}
              onClick={() => void switchMode()}
            >
              <SwitchIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{switchLabel}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Close" onClick={() => void close()}>
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close</TooltipContent>
        </Tooltip>
      </div>
    </ModuleProvider>
  );
}

// ── Full-page presentation switch ──────────────────────────
// The overlay host (DetailHeader) lets a record switch drawer↔modal and close;
// the full-page route has the breadcrumb + back for "close" and can't "maximize"
// (it IS maximized), but it had no way to COLLAPSE back into an overlay. This
// gives that parity: open the same record as a drawer/modal over its list (the
// list route comes from the manifest `routePrefix`). It rides in the embedded
// frame's `headerActions` slot. Guarded — if the form is dirty, the shared
// unsaved-guard confirms before navigating (the page wraps it in the provider).
export function DetailPresentationSwitch({
  typeId,
  entityId,
}: {
  typeId: string;
  entityId: string;
}) {
  const router = useRouter();
  const runGuard = useLeaveGuard();
  const found = findEntityType(typeId);
  if (!found) return null;
  const base = found.entityType.routePrefix;

  function openAs(mode: 'drawer' | 'modal') {
    void (async () => {
      if (!(await runGuard())) return;
      router.push(`${base}?${mode}=${typeId}:${entityId}`);
    })();
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Open as drawer"
            onClick={() => openAs('drawer')}
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open as drawer</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Open as modal"
            onClick={() => openAs('modal')}
          >
            <Square className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open as modal</TooltipContent>
      </Tooltip>
    </>
  );
}
