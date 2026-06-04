'use client';

// The full-page SeoReport body for /seo/<type>/<id> (the fullPage / newTab
// detail surface). Eagerly audits on mount, then renders the shared SeoReport
// with a link onward to the entity's editor — same component the overview
// overlays use, so the report looks identical in every surface.

import type { EntityType } from '@sparx/seo-audit';

import { SeoReport, useSeoAudit } from '@/components/seo/seo-score';
import { entityEditorHref, entityEditLabel } from '@/components/seo/links';

export function SeoReportPanel({ type, id }: { type: EntityType; id: string }) {
  const { card, loading, error, reload } = useSeoAudit(type, id, true);
  return (
    <SeoReport
      card={card}
      loading={loading}
      error={error}
      onReload={() => void reload()}
      editHref={entityEditorHref(type, id)}
      editLabel={entityEditLabel(type)}
    />
  );
}
