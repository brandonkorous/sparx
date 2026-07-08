'use client';

// The /seo overview's row → detail launcher. Honors the user's detail-view
// preference (docs/34 §7.2): `drawer` / `modal` open the full SeoReport in an
// overlay right here; `fullPage` / `newTab` go to the dedicated
// /seo/<type>/<id> report page. Same power-shortcuts as EntityRowLink
// (alt = drawer, shift = full page, ⌘/ctrl/middle-click = new tab). The report
// itself links onward to the entity's editor so you can jump to the fixes.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from 'silicaui-react';
import type { EntityType } from '@sparx/seo-audit';

import { SeoReport, useSeoAudit } from '@/components/seo/seo-score';
import { entityEditorHref, entityEditLabel } from '@/components/seo/links';
import { usePreferences } from '../../_components/preferences-provider';

type Overlay = 'drawer' | 'modal';

export function SeoRowLink({
  type,
  id,
  title,
  entityLabel,
  path,
}: {
  type: EntityType;
  id: string;
  title: string;
  entityLabel: string;
  path?: string | null;
}) {
  const router = useRouter();
  const prefs = usePreferences();
  const [overlay, setOverlay] = React.useState<Overlay | null>(null);
  // Lazy: only audit once an overlay is opened.
  const { card, loading, error, reload } = useSeoAudit(type, id, overlay !== null);

  const reportHref = `/seo/${type}/${id}`;
  const subtitle = path ? `${entityLabel} · ${path}` : entityLabel;

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0) return; // only intercept plain left-click
    if (e.metaKey || e.ctrlKey) return; // let the browser open reportHref in a new tab
    e.preventDefault();
    let mode = prefs.defaultDetailView;
    if (e.altKey) mode = 'drawer';
    else if (e.shiftKey) mode = 'fullPage';
    if (mode === 'newTab') {
      window.open(reportHref, '_blank', 'noopener');
      return;
    }
    if (mode === 'fullPage') {
      router.push(reportHref);
      return;
    }
    setOverlay(mode === 'modal' ? 'modal' : 'drawer');
  }

  const report = (
    <SeoReport
      card={card}
      loading={loading}
      error={error}
      onReload={() => void reload()}
      editHref={entityEditorHref(type, id)}
      editLabel={entityEditLabel(type)}
    />
  );

  return (
    <>
      <Link
        href={reportHref}
        onClick={handleClick}
        className="block text-left hover:underline focus-visible:underline focus-visible:outline-none"
      >
        <div className="font-medium">{title}</div>
        <div className="text-xs text-[var(--color-text-tertiary)]">{subtitle}</div>
      </Link>

      {overlay === 'drawer' ? (
        <Drawer open onOpenChange={(o) => !o && setOverlay(null)}>
          <DrawerContent side="right" className="sm:max-w-md">
            <div>
              <DrawerTitle>{title}</DrawerTitle>
              <DrawerDescription>{subtitle}</DrawerDescription>
            </div>
            <div className="p-0">{report}</div>
          </DrawerContent>
        </Drawer>
      ) : null}

      {overlay === 'modal' ? (
        <Dialog open onOpenChange={(o) => !o && setOverlay(null)}>
          <DialogContent className="p-0">
            <div className="border-b border-[var(--color-border-default)] p-4 pr-10">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{subtitle}</DialogDescription>
            </div>
            {report}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
