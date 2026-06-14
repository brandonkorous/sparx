// Site-wide SEO overview (docs/50 §7) — every page, product, and collection
// scored, worst first. Reads the stored snapshots (`GET /v1/seo/audits`) so the
// whole site renders without N live audits. A standard Collection/List surface
// (docs/34 §7): full width, ListToolbar with a type filter + Table/Cards toggle
// honoring the user's defaultListView, and a row that opens the full report in
// the user's detail-view surface. "Re-scan" recomputes everything.

import { Gauge } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { Card, Container, EmptyState, PageHeader, Stack, Text } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { type SeoAuditRow } from '@/components/seo/types';
import { getUserPreferences } from '../_shell/preferences';
import { ListToolbar } from '../_components/list-toolbar';
import { RescanButton } from './_components/rescan-button';
import { SeoAuditList } from './_components/seo-audit-list';

export const dynamic = 'force-dynamic';

const TYPE_OPTIONS = [
  { value: 'builder_page', label: 'Pages (Builder)' },
  { value: 'cms_page', label: 'Content' },
  { value: 'product', label: 'Products' },
  { value: 'collection', label: 'Collections' },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SeoOverviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const typeFilter = stringParam(params.type);

  const query = new URLSearchParams();
  if (typeFilter) query.set('type', typeFilter);

  const [session, prefs, rows] = await Promise.all([
    requireSession(),
    getUserPreferences(),
    api.get<SeoAuditRow[]>(`/v1/seo/audits${query.toString() ? `?${query.toString()}` : ''}`),
  ]);

  // Re-scan reindexes every entity — an `editor`-gated write. Viewers can read
  // the overview but shouldn't see an action that 403s on click.
  const role = session.user.role;
  const canScan = role === 'owner' || role === 'admin' || role === 'editor';

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  const count = rows.length;
  const avg = count ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / count) : null;

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Gauge className="h-5 w-5" />}
          title="SEO health"
          description="Every page, product, and collection scored — worst first, so you know where to start. Open any row for its full report; from there, jump to the editor to fix it."
          actions={canScan ? <RescanButton /> : undefined}
        />

        <ListToolbar
          searchable={false}
          filters={[{ key: 'type', label: 'Type', options: TYPE_OPTIONS }]}
          enableViewToggle
        />

        {count === 0 ? (
          <Card variant="module" padding="none">
            <EmptyState
              icon={<Gauge className="h-5 w-5" />}
              title={typeFilter ? 'Nothing of this type scored yet' : 'No audits yet'}
              description={
                typeFilter
                  ? 'Clear the filter, or run a scan to score every page, product, and collection.'
                  : 'Run a scan to score every page, product, and collection across your site.'
              }
              action={!typeFilter && canScan ? <RescanButton size="md" /> : undefined}
            />
          </Card>
        ) : (
          <>
            <Text size="sm" variant="muted">
              {count} page{count === 1 ? '' : 's'} scored
              {avg != null ? ` · average ${avg}/100` : ''}
            </Text>

            <SeoAuditList rows={rows} view={view} />
          </>
        )}
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
