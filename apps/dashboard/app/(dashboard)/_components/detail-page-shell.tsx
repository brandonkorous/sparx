'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button, cn, Container, ModuleProvider, Stack } from '@sparx/ui';

import { findEntityType, isFullBleedDetail } from '../_shell/detail-registry';
import { ViewSwitcher } from './detail-panel';
import {
  DetailChromeProvider,
  DetailFooterSlotTarget,
  DetailHeaderSlotTarget,
} from './detail-header-slot';
import { UnsavedGuardProvider, useLeaveGuard } from './unsaved-guard';

// Back-to-list link. A guarded action (not a plain <Link>): a full-page detail's
// editable body may hold unsaved edits, so leaving for the list routes through
// the unsaved-edits guard first — exactly like the presentation switch beside it.
// Rendered INSIDE the shell's UnsavedGuardProvider so it can consult the guard.
function DetailBackLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  const runGuard = useLeaveGuard();
  return (
    <Button
      variant="ghost"
      color="module"
      size="sm"
      onClick={() => {
        void Promise.resolve(runGuard()).then((ok) => {
          if (ok) router.push(href);
        });
      }}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}

// Title-case the last path segment of a route for the back-link label
// ("/commerce/products" → "Products"). The manifest stores SINGULAR entity
// labels, but the back link points at the LIST, so the plural list segment reads
// better than a naively pluralized singular ("Categorys").
function listLabelFor(href: string): string {
  const seg = href.split('/').filter(Boolean).pop() ?? '';
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Full-page host for a detail surface. The SAME server-rendered body also mounts
// inside the drawer/modal chrome (detail-panel), where the chrome owns the
// header bar. A full page has no chrome, so this supplies the equivalent: a
// back-link to the list, the body's teleported lifecycle actions (via the shared
// header slot), and the drawer/modal presentation switch — all under the module
// tint and the unsaved-edits guard the switch consults before it navigates.
export function DetailPageShell({
  typeId,
  entityId,
  children,
  listHref: listHrefProp,
  listLabel: listLabelProp,
  showViewSwitcher = true,
}: {
  typeId: string;
  entityId: string;
  children: React.ReactNode;
  // Optional back-link overrides for surfaces whose manifest routePrefix isn't the
  // list route (e.g. CMS `page` has routePrefix '/cms' but its list is
  // '/cms/content'). Defaults to the routePrefix-derived href + label.
  listHref?: string;
  listLabel?: string;
  // Opt out for entity types with no drawer/modal detail rendering registered
  // (e.g. billing-document — the document editor is deliberately full-page
  // only, docs/87). ViewSwitcher can't tell reachability apart from the
  // client-safe registry alone, so callers whose detail view was never wired
  // into `detailComponents` must suppress it explicitly rather than offer a
  // switch that opens an empty drawer/modal.
  showViewSwitcher?: boolean;
}) {
  const found = findEntityType(typeId);
  const moduleId = found?.manifest.id;
  const listHref = listHrefProp ?? found?.entityType.routePrefix ?? null;
  const listLabel = listLabelProp ?? (listHref ? listLabelFor(listHref) : null);

  // A full-bleed detail (a single-form SurfaceFrame edit, or a tabbed view with a
  // full-height summary aside like product) owns its own scroll + height, so the
  // page becomes a fixed-height frame and hands it the whole area edge-to-edge —
  // the same shape the create wizard's `embedded` frame uses. Other details keep
  // the centered, document-flow Container.
  const fullBleed = isFullBleedDetail(typeId);
  const body = (
    <Stack gap={0} className={cn(fullBleed && 'h-full')}>
      <div
        className={cn(
          'border-base-300 bg-base-100 @container/toolbar flex h-[52px] shrink-0 items-center gap-2 border-b px-2',
          // Reveal the zone-divider only when BOTH the lifecycle and
          // form-actions slots are actually populated (pure CSS — neither
          // slot's fill state is knowable in JS, they're portal targets).
          'has-[[data-slot=lifecycle]:not(:empty)]:has-[[data-slot=formactions]:not(:empty)]:[&>[data-slot=zone-divider]]:flex'
        )}
      >
        {listHref && <DetailBackLink href={listHref} label={listLabel ?? ''} />}
        <div className="flex-1" />
        <DetailHeaderSlotTarget className="flex items-center gap-2" />
        {/* Toolbar zone divider — Lifecycle (persisted-state actions) vs.
            Form-actions (the open edit's Cancel/Save) are categorically
            different; see the toolbar zone system. */}
        <div
          aria-hidden
          data-slot="zone-divider"
          className="bg-base-300 hidden h-5 w-px shrink-0"
        />
        {/* The body's form teleports its Save here, next to lifecycle actions —
            top-docked like every other toolbar on the platform, not floored at
            the page bottom. Zero-width until a form supplies one. */}
        <DetailFooterSlotTarget className="flex items-center gap-2" />
        {showViewSwitcher && <ViewSwitcher typeId={typeId} entityId={entityId} current="page" />}
      </div>
      {fullBleed ? (
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      ) : (
        <Container size="xl">
          <Stack gap={6} className="py-8">
            {children}
          </Stack>
        </Container>
      )}
    </Stack>
  );

  return (
    <UnsavedGuardProvider>
      <DetailChromeProvider>
        {moduleId ? (
          <ModuleProvider module={moduleId} className={cn(fullBleed && 'h-full')}>
            {body}
          </ModuleProvider>
        ) : (
          body
        )}
      </DetailChromeProvider>
    </UnsavedGuardProvider>
  );
}
