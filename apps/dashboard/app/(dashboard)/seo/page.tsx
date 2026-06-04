// Site-wide SEO overview (docs/50 §7) — every page, product, and collection
// scored, worst first. Reads the stored snapshots (`GET /v1/seo/audits`) so the
// whole site renders without N live audits; each row's chip re-runs a live audit
// on hover. "Re-scan" recomputes everything.

import { Card, Container, Heading, PageHeader, Stack, Text } from '@sparx/ui';
import { api } from '@/lib/api-rest-client';
import { SeoScoreChip } from '@/components/seo/seo-score';
import { ENTITY_LABEL, type SeoAuditRow } from '@/components/seo/types';
import { RescanButton } from './_components/rescan-button';

export const dynamic = 'force-dynamic';

export default async function SeoOverviewPage() {
  const rows = await api.get<SeoAuditRow[]>('/v1/seo/audits');
  const count = rows.length;
  const avg = count ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / count) : null;

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="SEO health"
          description="Every page, product, and collection scored — worst first, so you know where to start. Hover any score for the full report."
          actions={<RescanButton />}
        />

        {count === 0 ? (
          <Card variant="module" padding="lg">
            <Stack gap={3} align="start">
              <Heading level={4}>No audits yet</Heading>
              <Text size="sm" variant="muted">
                Run a scan to score every page, product, and collection across your storefront.
              </Text>
              <RescanButton size="md" />
            </Stack>
          </Card>
        ) : (
          <>
            <Text size="sm" variant="muted">
              {count} page{count === 1 ? '' : 's'} scored
              {avg != null ? ` · average ${avg}/100` : ''}
            </Text>
            <Card variant="module" padding="none">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left">
                    <th className="px-4 py-3 font-medium text-[var(--color-text-tertiary)]">
                      Score
                    </th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-tertiary)]">
                      Page
                    </th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-tertiary)]">
                      Top fix
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--color-border)] align-top last:border-0"
                    >
                      <td className="px-4 py-3">
                        <SeoScoreChip
                          type={r.entityType}
                          id={r.entityId}
                          initialScore={r.score}
                          initialGrade={r.grade}
                          lazy
                          size={30}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.title ?? '(untitled)'}</div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                          {ENTITY_LABEL[r.entityType]}
                          {r.path ? ` · ${r.path}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {r.fixFirst ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </Stack>
    </Container>
  );
}
