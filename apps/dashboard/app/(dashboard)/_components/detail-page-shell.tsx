'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button, cn, Container, ModuleProvider, Stack } from '@sparx/ui';

import { findEntityType, isFullBleedDetail } from '../_shell/detail-registry';
import { DetailPresentationSwitch } from './detail-panel';
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
}: {
  typeId: string;
  entityId: string;
  children: React.ReactNode;
  // Optional back-link overrides for surfaces whose manifest routePrefix isn't the
  // list route (e.g. CMS `page` has routePrefix '/cms' but its list is
  // '/cms/content'). Defaults to the routePrefix-derived href + label.
  listHref?: string;
  listLabel?: string;
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
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2">
        {listHref && <DetailBackLink href={listHref} label={listLabel ?? ''} />}
        <div className="flex-1" />
        <DetailHeaderSlotTarget className="flex items-center gap-2" />
        <DetailPresentationSwitch typeId={typeId} entityId={entityId} />
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
      {/* The body's form teleports its Save here. On a document-flow page the bar
          is sticky to the viewport bottom (parity with the overlay's floored
          footer); in a fixed-height frame it's the frame's own bottom rail.
          Zero-height until a form supplies one. */}
      <DetailFooterSlotTarget className={cn(fullBleed ? 'shrink-0' : 'sticky bottom-0 z-10')} />
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
