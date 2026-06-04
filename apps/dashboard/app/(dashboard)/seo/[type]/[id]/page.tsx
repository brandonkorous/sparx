// Full-page SEO report (docs/50 §7.6) — the `fullPage` / `newTab` detail surface
// for an audited entity. The overview's row link routes here when the user's
// detail-view preference is full page or new tab (or via ⌘/middle-click). A
// Wide record-detail per docs/34 §3.

import { notFound } from 'next/navigation';

import { Card, Container, PageHeader, Stack } from '@sparx/ui';
import type { EntityType } from '@sparx/seo-audit';

import { ENTITY_LABEL } from '@/components/seo/types';
import { SeoReportPanel } from '../../_components/seo-report-panel';

export const dynamic = 'force-dynamic';

const VALID_TYPES: EntityType[] = ['builder_page', 'cms_page', 'product', 'collection'];

interface PageProps {
  params: Promise<{ type: string; id: string }>;
}

export default async function SeoReportPage({ params }: PageProps) {
  const { type, id } = await params;
  if (!VALID_TYPES.includes(type as EntityType)) notFound();
  const entityType = type as EntityType;

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="SEO report"
          description={`${ENTITY_LABEL[entityType]} · the full scorecard and every check behind the score.`}
        />
        <Card variant="module" padding="none" className="overflow-hidden">
          <SeoReportPanel type={entityType} id={id} />
        </Card>
      </Stack>
    </Container>
  );
}
