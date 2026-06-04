// Site-wide SEO overview (docs/50 §7) — every page, product, and collection
// scored, worst first. Reads the stored snapshots (`GET /v1/seo/audits`) so the
// whole site renders without N live audits. A standard Collection/List surface
// (docs/34 §7): full width, ListToolbar with a type filter + Table/Cards toggle
// honoring the user's defaultListView, and a row that opens the full report in
// the user's detail-view surface. "Re-scan" recomputes everything.

import { Gauge } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import {
  Card,
  Container,
  EmptyState,
  Grid,
  PageHeader,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { SeoScoreBadge } from '@/components/seo/seo-score';
import { ENTITY_LABEL, type SeoAuditRow } from '@/components/seo/types';
import { getUserPreferences } from '../_shell/preferences';
import { ListToolbar } from '../_components/list-toolbar';
import { RescanButton } from './_components/rescan-button';
import { SeoRowLink } from './_components/seo-row-link';

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
                  : 'Run a scan to score every page, product, and collection across your storefront.'
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

            {view === 'card' ? (
              <Grid minItemWidth="20rem" gap={4}>
                {rows.map((r) => (
                  <Card key={r.id} variant="module" padding="md">
                    <Stack direction="row" gap={3} align="start">
                      <SeoScoreBadge score={r.score} grade={r.grade} size={36} />
                      <Stack gap={1} className="min-w-0 flex-1">
                        <SeoRowLink
                          type={r.entityType}
                          id={r.entityId}
                          title={r.title ?? '(untitled)'}
                          entityLabel={ENTITY_LABEL[r.entityType]}
                          path={r.path}
                        />
                        {r.fixFirst ? (
                          <Text size="xs" variant="muted">
                            Top fix: {r.fixFirst}
                          </Text>
                        ) : null}
                      </Stack>
                    </Stack>
                  </Card>
                ))}
              </Grid>
            ) : (
              <Card variant="module" padding="none">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Score</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Top fix</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <SeoScoreBadge score={r.score} grade={r.grade} size={30} />
                        </TableCell>
                        <TableCell>
                          <SeoRowLink
                            type={r.entityType}
                            id={r.entityId}
                            title={r.title ?? '(untitled)'}
                            entityLabel={ENTITY_LABEL[r.entityType]}
                            path={r.path}
                          />
                        </TableCell>
                        <TableCell>
                          <Text size="sm" variant="muted">
                            {r.fixFirst ?? '—'}
                          </Text>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
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
